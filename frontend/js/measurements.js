// =============================================================
// BODY MEASUREMENT MODULE
// Uses MediaPipe Pose landmarks
// =============================================================

const LM = {
  LEFT_EAR: 7,
  RIGHT_EAR: 8,

  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,

  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,

  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,

  LEFT_HIP: 23,
  RIGHT_HIP: 24,

  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,

  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28
};


// -------------------------------------------------------------
// Distance between two landmarks
// -------------------------------------------------------------

function pxDistance(p1, p2, w, h) {

  if (!p1 || !p2) return null;

  return Math.hypot(
    (p1.x - p2.x) * w,
    (p1.y - p2.y) * h
  );
}


// -------------------------------------------------------------
// Midpoint
// -------------------------------------------------------------

function midpoint(p1, p2) {

  if (!p1 || !p2) return null;

  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}


// -------------------------------------------------------------
// Check landmark visibility
// -------------------------------------------------------------

function validLandmark(p) {

  return (
    p &&
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    (p.visibility === undefined || p.visibility > 0.5)
  );
}


// -------------------------------------------------------------
// Calculate measurements
// -------------------------------------------------------------

function computeMeasurements(
  landmarks,
  canvasW,
  canvasH,
  refHeightCm
) {

  if (!landmarks) {
    return null;
  }


  // -----------------------------------------------------------
  // SHOULDERS
  // -----------------------------------------------------------

  const shoulderPx = pxDistance(
    landmarks[LM.LEFT_SHOULDER],
    landmarks[LM.RIGHT_SHOULDER],
    canvasW,
    canvasH
  );


  // -----------------------------------------------------------
  // HIPS
  // -----------------------------------------------------------

  const hipPx = pxDistance(
    landmarks[LM.LEFT_HIP],
    landmarks[LM.RIGHT_HIP],
    canvasW,
    canvasH
  );


  // -----------------------------------------------------------
  // TORSO
  // -----------------------------------------------------------

  const shoulderMid = midpoint(
    landmarks[LM.LEFT_SHOULDER],
    landmarks[LM.RIGHT_SHOULDER]
  );

  const hipMid = midpoint(
    landmarks[LM.LEFT_HIP],
    landmarks[LM.RIGHT_HIP]
  );

  const torsoPx = pxDistance(
    shoulderMid,
    hipMid,
    canvasW,
    canvasH
  );


  // -----------------------------------------------------------
  // LEFT ARM
  // -----------------------------------------------------------

  const leftShoulderElbow = pxDistance(
    landmarks[LM.LEFT_SHOULDER],
    landmarks[LM.LEFT_ELBOW],
    canvasW,
    canvasH
  );

  const leftElbowWrist = pxDistance(
    landmarks[LM.LEFT_ELBOW],
    landmarks[LM.LEFT_WRIST],
    canvasW,
    canvasH
  );

  const leftArmPx =
    leftShoulderElbow !== null &&
    leftElbowWrist !== null
      ? leftShoulderElbow + leftElbowWrist
      : null;


  // -----------------------------------------------------------
  // RIGHT ARM
  // -----------------------------------------------------------

  const rightShoulderElbow = pxDistance(
    landmarks[LM.RIGHT_SHOULDER],
    landmarks[LM.RIGHT_ELBOW],
    canvasW,
    canvasH
  );

  const rightElbowWrist = pxDistance(
    landmarks[LM.RIGHT_ELBOW],
    landmarks[LM.RIGHT_WRIST],
    canvasW,
    canvasH
  );

  const rightArmPx =
    rightShoulderElbow !== null &&
    rightElbowWrist !== null
      ? rightShoulderElbow + rightElbowWrist
      : null;


  // -----------------------------------------------------------
  // FULL BODY HEIGHT
  // -----------------------------------------------------------

  const headTop = midpoint(
    landmarks[LM.LEFT_EAR],
    landmarks[LM.RIGHT_EAR]
  );

  const ankleMid = midpoint(
    landmarks[LM.LEFT_ANKLE],
    landmarks[LM.RIGHT_ANKLE]
  );

  const heightPx = pxDistance(
    headTop,
    ankleMid,
    canvasW,
    canvasH
  );


  // -----------------------------------------------------------
  // SCALE
  //
  // We need full body for absolute cm conversion.
  // -----------------------------------------------------------

  if (!heightPx || heightPx <= 1) {

    console.warn(
      'Full body not visible. Head and both ankles are required.'
    );

    return {
      shoulderWidth: null,
      hipWidth: null,
      torsoHeight: null,
      height: null,
      leftArmLength: null,
      rightArmLength: null,
      leftLegLength: null,
      rightLegLength: null,
      detectedHeightPx: null,
      scaleFactor: null,
      fullBodyRequired: true
    };
  }


  const scale =
    refHeightCm / heightPx;


  // -----------------------------------------------------------
  // LEGS
  // -----------------------------------------------------------

  const leftHipKnee = pxDistance(
    landmarks[LM.LEFT_HIP],
    landmarks[LM.LEFT_KNEE],
    canvasW,
    canvasH
  );

  const leftKneeAnkle = pxDistance(
    landmarks[LM.LEFT_KNEE],
    landmarks[LM.LEFT_ANKLE],
    canvasW,
    canvasH
  );

  const leftLegPx =
    leftHipKnee !== null &&
    leftKneeAnkle !== null
      ? leftHipKnee + leftKneeAnkle
      : null;


  const rightHipKnee = pxDistance(
    landmarks[LM.RIGHT_HIP],
    landmarks[LM.RIGHT_KNEE],
    canvasW,
    canvasH
  );

  const rightKneeAnkle = pxDistance(
    landmarks[LM.RIGHT_KNEE],
    landmarks[LM.RIGHT_ANKLE],
    canvasW,
    canvasH
  );

  const rightLegPx =
    rightHipKnee !== null &&
    rightKneeAnkle !== null
      ? rightHipKnee + rightKneeAnkle
      : null;


  // -----------------------------------------------------------
  // RESULT
  // -----------------------------------------------------------

  return {

    shoulderWidth:
      shoulderPx !== null
        ? (shoulderPx * scale).toFixed(1)
        : '--',

    hipWidth:
      hipPx !== null
        ? (hipPx * scale).toFixed(1)
        : '--',

    torsoHeight:
      torsoPx !== null
        ? (torsoPx * scale).toFixed(1)
        : '--',

    height:
      refHeightCm.toFixed(1),

    leftArmLength:
      leftArmPx !== null
        ? (leftArmPx * scale).toFixed(1)
        : '--',

    rightArmLength:
      rightArmPx !== null
        ? (rightArmPx * scale).toFixed(1)
        : '--',

    leftLegLength:
      leftLegPx !== null
        ? (leftLegPx * scale).toFixed(1)
        : '--',

    rightLegLength:
      rightLegPx !== null
        ? (rightLegPx * scale).toFixed(1)
        : '--',

    detectedHeightPx:
      Math.round(heightPx),

    scaleFactor:
      scale.toFixed(4),

    fullBodyRequired: false
  };
}


// -------------------------------------------------------------
// Render measurements
// -------------------------------------------------------------

function renderMeasurements(measurements) {

  if (!measurements) {
    console.warn('No measurements to render');
    return;
  }


  if (measurements.fullBodyRequired) {

    alert(
      'Please stand far enough from the camera so your full body, including both ankles, is visible.'
    );

    return;
  }


  const fields = [

    {
      id: 'm-shoulder',
      val: measurements.shoulderWidth
    },

    {
      id: 'm-hip',
      val: measurements.hipWidth
    },

    {
      id: 'm-torso',
      val: measurements.torsoHeight
    },

    {
      id: 'm-height',
      val: measurements.height
    },

    {
      id: 'm-larm',
      val: measurements.leftArmLength
    },

    {
      id: 'm-rarm',
      val: measurements.rightArmLength
    },

    {
      id: 'm-lleg',
      val: measurements.leftLegLength
    },

    {
      id: 'm-rleg',
      val: measurements.rightLegLength
    }

  ];


  fields.forEach((field) => {

    const element =
      document.getElementById(field.id);

    if (!element) {

      console.warn(
        'Measurement element not found:',
        field.id
      );

      return;
    }


    element.innerHTML =
      `${field.val}<span class="unit">cm</span>`;


    if (element.parentElement) {

      element.parentElement.classList.add(
        'has-data'
      );
    }

  });


  const lastScanEl =
    document.getElementById('lastScanText');


  if (lastScanEl) {

    lastScanEl.textContent =
      'LAST SCAN · JUST NOW';

    lastScanEl.dataset.time =
      Date.now();

    startLastScanTicker();

  }


  console.log(
    'MEASUREMENTS:',
    measurements
  );
}


// -------------------------------------------------------------
// Last scan timer
// -------------------------------------------------------------

let scanTickerHandle = null;


function startLastScanTicker() {

  if (scanTickerHandle) {

    clearInterval(
      scanTickerHandle
    );

  }


  scanTickerHandle =
    setInterval(() => {

      const el =
        document.getElementById(
          'lastScanText'
        );


      if (!el || !el.dataset.time) {
        return;
      }


      const seconds =
        Math.floor(
          (Date.now() -
            parseInt(el.dataset.time)) /
          1000
        );


      if (seconds < 60) {

        el.textContent =
          `LAST SCAN · ${seconds}S AGO`;

      }

      else if (seconds < 3600) {

        el.textContent =
          `LAST SCAN · ${Math.floor(seconds / 60)}M AGO`;

      }

      else {

        el.textContent =
          `LAST SCAN · ${Math.floor(seconds / 3600)}H AGO`;

      }

    }, 1000);

}