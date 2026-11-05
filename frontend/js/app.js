// =============================================================
// MAIN APP — VITRY / STUDIO 01
// =============================================================


// ---------- DOM ----------

const video = document.getElementById('cam');
const canvas = document.getElementById('overlay');
const placeholder = document.getElementById('placeholder');
const camBtn = document.getElementById('camBtn');

const captureBtn = document.getElementById('captureBtn');
const garmentGrid = document.getElementById('garmentGrid');
const logEl = document.getElementById('log');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const fpsTag = document.getElementById('fpsTag');
const timerTag = document.getElementById('timerTag');
const garmentTag = document.getElementById('garmentTag');
const standbyTag = document.getElementById('standbyTag');
const selvedge = document.getElementById('selvedge');
const selvedgeSwatch = document.getElementById('selvedgeSwatch');
const selvedgeName = document.getElementById('selvedgeName');
const modalOverlay = document.getElementById('modalOverlay');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const refHeightInput = document.getElementById('refHeight');


// ---------- State ----------

let stream = null;
let rtvCameraRunning = false;
let detecting = false;
let selectedGarment = null;
let frameCount = 0;
let lastFpsTime = performance.now();
let detectionLoopId = null;

const TIMEOUT_MS = 60 * 1000;
let timeoutHandle = null;
let timerIntervalHandle = null;
let timerStartedAt = null;
let personDetectedAtLeastOnce = false;


// ---------- Utilities ----------

function log(msg) {
  const t = new Date().toLocaleTimeString();
  logEl.innerHTML += `<div>[${t}] ${msg}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}


function setStatus(text) {
  statusText.textContent = text;
}


function setStandby(text) {
  standbyTag.innerHTML =
    `<span class="standby-dot"></span> ${text}`;
}


// ---------- Garment Grid ----------

async function buildGarmentGrid() {
  try {

    const response = await fetch('/garments');

    if (!response.ok) {
      throw new Error('Could not load RTV garments');
    }

    const garments = await response.json();

    garmentGrid.innerHTML = '';

    garments.forEach((g) => {

      const imageName = g.name.replace('_vmsdp2ta', '');

      const card = document.createElement('div');

      card.className = 'gar-card';
      card.dataset.id = g.id;

      card.innerHTML = `
        <span class="gar-type">RTV</span>
        <span class="gar-check">✓</span>

        <div
          class="gar-image"
          style="
            background-image:
              url('/assets/garment_images/${imageName}_white_bg.jpg');
          "
        ></div>

        <div class="gar-info">
          <p class="gar-title">${imageName}</p>

          <div class="gar-meta">
            <span>RTV VITON</span>
            <span class="gar-price">RTV</span>
          </div>
        </div>
      `;


      card.addEventListener('click', async () => {

        document
          .querySelectorAll('.gar-card')
          .forEach(c => c.classList.remove('active'));

        card.classList.add('active');

        selectedGarment = g;

        garmentTag.textContent =
          imageName.toUpperCase();

        selvedge.style.display = 'flex';

        selvedgeSwatch.style.background = '#222';

        selvedgeName.textContent = imageName;

        log(`Selecting RTV garment: ${imageName}`);

        try {

          const result = await fetch(`/garment/${g.id}`, {
            method: 'POST'
          });

          const data = await result.json();

          if (!data.success) {
            throw new Error(
              data.message || 'Garment selection failed'
            );
          }

          log(`RTV garment selected: ${data.name}`);

          setStatus('RTV GARMENT LOADING');
          setStandby('LOADING GARMENT');

          setTimeout(() => {

            if (rtvCameraRunning) {
              setStatus('CAMERA LIVE');
              setStandby('RTV FITTING');
            }

          }, 1500);

        } catch (error) {

          console.error(error);

          log(
            `Garment selection error: ${error.message}`
          );

          setStatus('GARMENT ERROR');

          alert(
            'Could not select RTV garment: ' +
            error.message
          );
        }
      });


      garmentGrid.appendChild(card);

    });


    log(`Loaded ${garments.length} RTV garments`);

  } catch (error) {

    console.error(error);

    log(
      `Could not load RTV garments: ${error.message}`
    );

    setStatus('GARMENT LOAD FAILED');
  }
}


// ---------- Camera ----------

async function openCamera() {

  try {

    setStatus('STARTING RTV');

    const response = await fetch('/camera/start', {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        'Could not start RTV camera'
      );
    }


    /*
     * Camera is controlled by Python/RTV.
     * We do NOT use navigator.mediaDevices.getUserMedia().
     *
     * /video is the MJPEG stream generated by backend.py.
     */

    video.style.display = 'none';

    let rtvImage =
      document.getElementById('rtvOutput');


    if (!rtvImage) {

      rtvImage = document.createElement('img');

      rtvImage.id = 'rtvOutput';

      rtvImage.style.width = '100%';
      rtvImage.style.height = '100%';
      rtvImage.style.objectFit = 'contain';

      video.parentNode.insertBefore(
        rtvImage,
        video
      );
    }


    rtvImage.src = '/video';

    placeholder.style.display = 'none';


    camBtn.innerHTML =
      '<span class="ctrl-icon">▭</span> STOP CAMERA';


    // Capture is enabled as soon as the RTV camera starts.
    // MediaPipe runs automatically in the background.

    captureBtn.disabled = false;


    setStatus('CAMERA LIVE');
    setStandby('RTV FITTING');

    rtvCameraRunning = true;

    log('RTV camera started');
    log('RTV VITON pipeline connected');


    // Automatically start pose detection.
    // There is NO separate Detect Pose button.

    startPoseDetection();


  } catch (e) {

    setStatus('CAMERA ERROR');

    log(
      `RTV camera error: ${e.message}`
    );

    alert(
      'Could not start RTV camera: ' +
      e.message
    );
  }
}


// ---------- Stop Camera ----------

async function stopCamera() {

  try {

    await fetch('/camera/stop', {
      method: 'POST'
    });

  } catch (e) {

    log(
      `RTV camera stop error: ${e.message}`
    );
  }


  const rtvImage =
    document.getElementById('rtvOutput');


  if (rtvImage) {
    rtvImage.removeAttribute('src');
  }


  video.style.display = 'none';

  placeholder.style.display = 'flex';


  camBtn.innerHTML =
    '<span class="ctrl-icon">▶</span> OPEN CAMERA';


  captureBtn.disabled = true;


  fpsTag.style.display = 'none';


  detecting = false;


  if (detectionLoopId) {

    cancelAnimationFrame(
      detectionLoopId
    );

    detectionLoopId = null;
  }


  clearNoPersonTimeout();


  if (poseDetector) {
    poseDetector.lastLandmarks = null;
  }


  // Clear the invisible overlay canvas.
  // No skeleton is drawn.

  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }


  setStatus('SYSTEM IDLE');
  setStandby('STANDBY');


  rtvCameraRunning = false;


  log('RTV camera stopped');
}


// ---------- Timeout ----------

function startNoPersonTimeout() {

  clearNoPersonTimeout();

  personDetectedAtLeastOnce = false;

  timerStartedAt = Date.now();

  timerTag.style.display = 'block';


  timerIntervalHandle = setInterval(() => {

    if (personDetectedAtLeastOnce) {

      timerTag.style.display = 'none';

      clearInterval(
        timerIntervalHandle
      );

      return;
    }


    const elapsed =
      Date.now() - timerStartedAt;


    const remaining = Math.max(
      0,
      Math.ceil(
        (TIMEOUT_MS - elapsed) / 1000
      )
    );


    timerTag.textContent =
      `⧗ ${remaining}S — WAITING FOR BODY`;

  }, 1000);


  timeoutHandle = setTimeout(() => {

    if (!personDetectedAtLeastOnce) {

      log(
        'Timeout: no person detected in 60 seconds'
      );

      stopCamera();

      modalOverlay.style.display = 'flex';
    }

  }, TIMEOUT_MS);
}


function clearNoPersonTimeout() {

  if (timeoutHandle) {

    clearTimeout(timeoutHandle);

    timeoutHandle = null;
  }


  if (timerIntervalHandle) {

    clearInterval(
      timerIntervalHandle
    );

    timerIntervalHandle = null;
  }


  timerTag.style.display = 'none';
}


function markPersonDetected() {

  if (!personDetectedAtLeastOnce) {

    personDetectedAtLeastOnce = true;

    clearNoPersonTimeout();

    log(
      'Body detected — timeout cleared'
    );

    setStatus('BODY DETECTED');

    setStandby('FITTING');
  }
}


// ---------- Modal ----------

modalCloseBtn.addEventListener(
  'click',
  () => {
    modalOverlay.style.display = 'none';
  }
);


// =============================================================
// POSE DETECTION
// =============================================================
//
// Pose detection starts automatically when camera starts.
//
// There is NO DETECT POSE button.
//
// MediaPipe runs silently in the background.
// The skeleton is NOT displayed.
//
// =============================================================

async function startPoseDetection() {

  if (detecting) {
    return;
  }


  setStatus('LOADING MEDIAPIPE');

  log(
    'Loading MediaPipe Pose model...'
  );


  try {

    await poseDetector.init();

  } catch (e) {

    setStatus('MODEL LOAD FAILED');

    log(
      `Model error: ${e.message}`
    );

    return;
  }


  log(
    'MediaPipe Pose model loaded'
  );


  poseDetector.onLandmarks =
    (landmarks) => {

      if (landmarks) {

        markPersonDetected();


        // Keep canvas dimensions synchronized
        // with the RTV image.

        const rtvImage =
          document.getElementById('rtvOutput');

        if (rtvImage) {

          if (
            rtvImage.naturalWidth > 0 &&
            rtvImage.naturalHeight > 0
          ) {

            canvas.width =
              rtvImage.naturalWidth;

            canvas.height =
              rtvImage.naturalHeight;
          }
        }


        // =====================================================
        // NO SKELETON
        // =====================================================
        //
        // We intentionally DO NOT call:
        //
        // poseDetector.drawSkeleton(...)
        //
        // MediaPipe still detects the body and updates:
        //
        // poseDetector.lastLandmarks
        //
        // Capture Measurements uses those landmarks.
        // =====================================================


        captureBtn.disabled = false;

      } else {

        // Keep the overlay canvas empty.

        const ctx =
          canvas.getContext('2d');

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
      }
    };


  detecting = true;


  fpsTag.style.display = 'block';


  setStatus('DETECTING POSE');

  log(
    'Pose detection started automatically'
  );


  const loop = async () => {

    if (!detecting) {
      return;
    }


    // The RTV camera stream is in rtvOutput,
    // not in the hidden video element.

    const rtvImage =
      document.getElementById('rtvOutput');


    if (
      rtvImage &&
      rtvImage.complete &&
      rtvImage.naturalWidth > 0 &&
      rtvImage.naturalHeight > 0
    ) {

      if (
        canvas.width !== rtvImage.naturalWidth ||
        canvas.height !== rtvImage.naturalHeight
      ) {

        canvas.width =
          rtvImage.naturalWidth;

        canvas.height =
          rtvImage.naturalHeight;
      }


      try {

        await poseDetector.detect(
          rtvImage
        );

      } catch (e) {

        console.warn(
          'Pose detection frame skipped:',
          e.message
        );
      }


      frameCount++;


      const now =
        performance.now();


      if (
        now - lastFpsTime > 500
      ) {

        const fps =
          Math.round(
            (frameCount * 1000) /
            (now - lastFpsTime)
          );


        fpsTag.textContent =
          `${fps} FPS`;


        frameCount = 0;

        lastFpsTime = now;
      }
    }


    detectionLoopId =
      requestAnimationFrame(loop);
  };


  loop();
}


// =============================================================
// BINDINGS
// =============================================================

camBtn.addEventListener(
  'click',
  () => {

    if (rtvCameraRunning) {

      stopCamera();

    } else {

      openCamera();
    }
  }
);


// =============================================================
// CAPTURE MEASUREMENTS
// =============================================================

captureBtn.addEventListener(
  'click',
  () => {

    // Camera must be running.

    if (!rtvCameraRunning) {

      log(
        'Open the camera before capturing measurements'
      );

      return;
    }


    // MediaPipe must have detected a body.

    if (!poseDetector.lastLandmarks) {

      log(
        'No landmarks available — stand fully visible in camera'
      );

      return;
    }


    const refH =
      parseFloat(
        refHeightInput.value
      ) || 170;


    // Make sure canvas dimensions correspond
    // to the RTV stream.

    const rtvImage =
      document.getElementById('rtvOutput');

    if (
      rtvImage &&
      rtvImage.naturalWidth > 0 &&
      rtvImage.naturalHeight > 0
    ) {

      canvas.width =
        rtvImage.naturalWidth;

      canvas.height =
        rtvImage.naturalHeight;
    }


    const m =
      computeMeasurements(
        poseDetector.lastLandmarks,
        canvas.width,
        canvas.height,
        refH
      );


    if (!m) {

      log(
        'Could not calculate measurements'
      );

      return;
    }


    renderMeasurements(m);


    log(
      `Measurements captured (reference height: ${refH} cm)`
    );


    // Smooth scroll to Body Atlas.

    document
      .getElementById('measure')
      .scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
  }
);


// =============================================================
// SMOOTH SCROLL FOR NAV
// =============================================================

document
  .querySelectorAll('.nav-links a')
  .forEach(a => {

    a.addEventListener(
      'click',
      (e) => {

        e.preventDefault();


        const target =
          document.querySelector(
            a.getAttribute('href')
          );


        if (target) {

          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    );
  });


// =============================================================
// INIT
// =============================================================

buildGarmentGrid();


log(
  'Studio initialized. Ready when you are.'
);


log(
  'Camera will auto-close after 60s if no body is detected.'
);