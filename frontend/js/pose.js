// =============================================================
// POSE DETECTION MODULE
// MediaPipe Pose
//
// Purpose:
// - Detect body landmarks
// - Store landmarks for measurements
// - DO NOT draw skeleton
// =============================================================

class PoseDetector {

  constructor() {
    this.pose = null;

    // Latest detected body landmarks.
    // measurements.js uses this.
    this.lastLandmarks = null;

    // Callback used by app.js.
    this.onLandmarks = null;
  }


  // ===========================================================
  // INITIALIZE MEDIAPIPE
  // ===========================================================

  async init() {

    if (this.pose) {
      return;
    }


    this.pose = new window.Pose({

      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`

    });


    this.pose.setOptions({

      modelComplexity: 1,

      smoothLandmarks: true,

      enableSegmentation: false,

      minDetectionConfidence: 0.5,

      minTrackingConfidence: 0.5

    });


    // =========================================================
    // MEDIAPIPE RESULTS
    // =========================================================

    this.pose.onResults((results) => {

      if (results.poseLandmarks) {

        // Save landmarks for measurement calculation.
        this.lastLandmarks =
          results.poseLandmarks;

      } else {

        this.lastLandmarks = null;

      }


      // Tell app.js that new landmarks are available.

      if (this.onLandmarks) {

        this.onLandmarks(
          results.poseLandmarks || null
        );

      }

    });

  }


  // ===========================================================
  // DETECT BODY
  // ===========================================================

  async detect(videoElement) {

    if (!this.pose) {
      return;
    }


    try {

      await this.pose.send({
        image: videoElement
      });

    } catch (e) {

      console.warn(
        'Pose detection frame skipped:',
        e.message
      );

    }

  }


  // ===========================================================
  // NO drawSkeleton() FUNCTION
  // ===========================================================
  //
  // We intentionally removed the drawing function completely.
  //
  // MediaPipe only detects landmarks.
  //
  // app.js can use:
  //
  //     poseDetector.lastLandmarks
  //
  // for calculating measurements.
  //
  // ===========================================================

}


// =============================================================
// GLOBAL POSE DETECTOR
// =============================================================

const poseDetector = new PoseDetector();