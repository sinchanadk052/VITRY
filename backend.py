import cv2
import time
import threading

from flask import Flask, Response, jsonify, send_from_directory

from VITON.viton_upperbody import FrameProcessor


# ============================================================
# FLASK
# ============================================================

app = Flask(__name__, static_folder="frontend")


# ============================================================
# ASSETS
# ============================================================

@app.route("/assets/<path:filename>")
def assets(filename):
    return send_from_directory(
        "/home/sana/RTV/assets",
        filename
    )


# ============================================================
# RTV GARMENTS
# ============================================================

GARMENT_NAMES = [
    "lab_03_vmsdp2ta",
    "lab_04_vmsdp2ta",
    "lab_07_vmsdp2ta",
    "jin_17_vmsdp2ta",
    "jin_18_vmsdp2ta",
    "jin_22_vmsdp2ta",
]


# ============================================================
# RTV WORKER
# ============================================================

class RTVWorker:

    def __init__(self, garment_names):

        self.garment_names = garment_names

        self.camera = None
        self.running = False

        self.thread = None

        self.latest_frame = None
        self.frame_lock = threading.Lock()

        # ----------------------------------------------------
        # IMPORTANT:
        #
        # DO NOT create FrameProcessor here.
        #
        # FrameProcessor contains the RTV OpenGL renderer.
        # OpenGL/EGL context must belong to the thread that
        # actually performs the rendering.
        #
        # Therefore it will be created inside run().
        # ----------------------------------------------------

        self.frame_processor = None

        # Used to tell the Flask request when the worker has
        # finished creating its FrameProcessor.
        self.processor_ready = threading.Event()

        # Protect start/stop from simultaneous requests.
        self.worker_lock = threading.Lock()


    # ========================================================
    # CAMERA
    # ========================================================

    def open_camera(self):

        if self.camera is not None and self.camera.isOpened():
            return True

        print("Opening RTV camera...")

        cap = cv2.VideoCapture(0, cv2.CAP_V4L2)

        cap.set(
            cv2.CAP_PROP_FOURCC,
            cv2.VideoWriter_fourcc(*"MJPG")
        )

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if not cap.isOpened():

            print("ERROR: Could not open camera.")

            cap.release()

            return False

        fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))

        codec = "".join(
            chr((fourcc >> (8 * i)) & 0xFF)
            for i in range(4)
        )

        print("Camera codec:", codec)
        print("Width:", cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        print("Height:", cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        self.camera = cap

        return True


    # ========================================================
    # WORKER LOOP
    # ========================================================

    def run(self):

        print("RTV worker thread started.")

        # ----------------------------------------------------
        # CREATE FRAME PROCESSOR INSIDE WORKER THREAD
        # ----------------------------------------------------

        try:

            print("Initializing RTV FrameProcessor...")

            self.frame_processor = FrameProcessor(
                self.garment_names
            )

            print("RTV FrameProcessor initialized.")

            self.processor_ready.set()

        except Exception:

            import traceback

            print("ERROR: Could not initialize RTV FrameProcessor.")

            traceback.print_exc()

            self.processor_ready.set()

            self.running = False

            return


        # ----------------------------------------------------
        # MAIN CAMERA + RTV LOOP
        # ----------------------------------------------------

        while self.running:

            if self.camera is None:

                time.sleep(0.01)

                continue


            ret, frame = self.camera.read()


            if not ret:

                print("Camera frame read failed.")

                time.sleep(0.01)

                continue


            try:

                # ==================================================
                # EXISTING RTV PROCESSING
                #
                # FrameProcessor and its OpenGL renderer were
                # created in THIS SAME worker thread.
                # ==================================================

                output_frame = self.frame_processor(frame)


            except Exception:

                import traceback

                print("RTV processing error:")

                traceback.print_exc()

                # Keep raw camera frame visible if processing
                # temporarily fails.

                output_frame = frame


            # ----------------------------------------------------
            # JPEG ENCODE
            # ----------------------------------------------------

            success, encoded = cv2.imencode(
                ".jpg",
                output_frame,
                [cv2.IMWRITE_JPEG_QUALITY, 85]
            )


            if not success:

                continue


            frame_bytes = encoded.tobytes()


            with self.frame_lock:

                self.latest_frame = frame_bytes


        # ----------------------------------------------------
        # WORKER IS ENDING
        #
        # IMPORTANT:
        # Clear FrameProcessor while still inside the worker
        # thread so its OpenGL-related objects are released
        # from the same thread that owns them.
        # ----------------------------------------------------

        print("Cleaning up RTV FrameProcessor...")

        self.frame_processor = None

        self.processor_ready.clear()

        print("RTV worker thread stopped.")


    # ========================================================
    # START
    # ========================================================

    def start(self):

        with self.worker_lock:

            if self.running:

                return True


            # Clear anything left from previous run.

            self.processor_ready.clear()

            with self.frame_lock:

                self.latest_frame = None


            if not self.open_camera():

                return False


            self.running = True


            self.thread = threading.Thread(
                target=self.run,
                daemon=True
            )


            self.thread.start()


            return True


    # ========================================================
    # STOP
    # ========================================================

    def stop(self):

        with self.worker_lock:

            print("Stopping RTV worker...")

            self.running = False


            # ------------------------------------------------
            # Wait for worker to finish its current frame.
            # ------------------------------------------------

            if self.thread is not None:

                self.thread.join(timeout=5)

                if self.thread.is_alive():

                    print(
                        "WARNING: RTV worker did not stop "
                        "within timeout."
                    )

                else:

                    self.thread = None


            # ------------------------------------------------
            # Release camera after worker has stopped using it.
            # ------------------------------------------------

            if self.camera is not None:

                self.camera.release()

                self.camera = None


            # ------------------------------------------------
            # Clear last frame.
            # ------------------------------------------------

            with self.frame_lock:

                self.latest_frame = None


            # Make absolutely sure the processor reference
            # is gone before another worker is created.

            self.frame_processor = None

            self.processor_ready.clear()


            print("RTV camera stopped.")


    # ========================================================
    # FRAME
    # ========================================================

    def get_frame(self):

        with self.frame_lock:

            return self.latest_frame


    # ========================================================
    # GARMENT
    # ========================================================

    def select_garment(self, garment_id):

        if garment_id < 0 or garment_id >= len(self.garment_names):

            return False


        # Camera/worker must be running.

        if not self.running:

            print(
                "Cannot select garment: RTV camera is not running."
            )

            return False


        # ----------------------------------------------------
        # Wait until FrameProcessor has been created inside
        # the worker thread.
        # ----------------------------------------------------

        if not self.processor_ready.wait(timeout=120):

            print(
                "Cannot select garment: "
                "FrameProcessor initialization timed out."
            )

            return False


        if self.frame_processor is None:

            print(
                "Cannot select garment: "
                "FrameProcessor is unavailable."
            )

            return False


        print(
            "Selecting RTV garment:",
            garment_id,
            self.garment_names[garment_id]
        )


        self.frame_processor.set_target_garment(
            garment_id
        )


        return True


# ============================================================
# CREATE RTV WORKER
# ============================================================

rtv_worker = RTVWorker(GARMENT_NAMES)


# ============================================================
# FRONTEND
# ============================================================

@app.route("/")
def index():

    return send_from_directory(
        "frontend",
        "index.html"
    )


@app.route("/<path:path>")
def frontend_files(path):

    return send_from_directory(
        "frontend",
        path
    )


# ============================================================
# CAMERA START
# ============================================================

@app.route("/camera/start", methods=["POST"])
def camera_start():

    success = rtv_worker.start()


    if success:

        return jsonify({
            "success": True,
            "message": "RTV camera started"
        })


    return jsonify({
        "success": False,
        "message": "Could not open RTV camera"
    }), 500


# ============================================================
# CAMERA STOP
# ============================================================

@app.route("/camera/stop", methods=["POST"])
def camera_stop():

    rtv_worker.stop()


    return jsonify({
        "success": True,
        "message": "RTV camera stopped"
    })


# ============================================================
# VIDEO STREAM
# ============================================================

@app.route("/video")
def video():

    def generate():

        while True:

            frame = rtv_worker.get_frame()


            if frame is None:

                if not rtv_worker.running:

                    break


                time.sleep(0.01)

                continue


            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )


            time.sleep(0.001)


    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# ============================================================
# GARMENTS
# ============================================================

@app.route("/garments")
def garments():

    result = []


    for i, name in enumerate(GARMENT_NAMES):

        result.append({
            "id": i,
            "name": name
        })


    return jsonify(result)


# ============================================================
# SELECT GARMENT
# ============================================================

@app.route("/garment/<int:garment_id>", methods=["POST"])
def select_garment(garment_id):

    if garment_id < 0 or garment_id >= len(GARMENT_NAMES):

        return jsonify({
            "success": False,
            "message": "Invalid garment ID"
        }), 400


    success = rtv_worker.select_garment(
        garment_id
    )


    if not success:

        return jsonify({
            "success": False,
            "message": "Could not select garment"
        }), 500


    return jsonify({
        "success": True,
        "id": garment_id,
        "name": GARMENT_NAMES[garment_id]
    })


# ============================================================
# STATUS
# ============================================================

@app.route("/status")
def status():

    return jsonify({
        "camera": rtv_worker.running,
        "garments": GARMENT_NAMES
    })

@app.route("/measurements", methods=["POST"])
def measurements():
    return jsonify({
        "success": True,
        "measurements": {
            "shoulder": 0,
            "hip": 0,
            "torso": 0,
            "height": 0,
            "left_arm": 0,
            "right_arm": 0,
            "left_leg": 0,
            "right_leg": 0
        }
    })
# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print()

    print("========================================")
    print(" RTV + VITRY BACKEND")
    print("========================================")

    print()


    app.run(
        host="0.0.0.0",
        port=5000,
        threaded=True
    )

