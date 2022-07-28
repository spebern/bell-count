let heading = document.querySelector('h1');
heading.textContent = 'CLICK ANYWHERE TO START'
document.body.addEventListener('click', init);


function init() {
  heading.textContent = 'Voice-change-O-matic';
  document.body.removeEventListener('click', init)

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }


  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {

      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }

  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var voiceSelect = document.getElementById("voice");
  var source;
  var stream;

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;

  var distortion = audioCtx.createWaveShaper();
  var gainNode = audioCtx.createGain();
  var biquadFilter = audioCtx.createBiquadFilter();
  var convolver = audioCtx.createConvolver();

  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var intendedWidth = document.querySelector('.wrapper').clientWidth;

  canvas.setAttribute('width', intendedWidth);

  var visualSelect = document.getElementById("visual");

  if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');
    var constraints = { audio: true }
    navigator.mediaDevices.getUserMedia(constraints)
      .then(
        function (stream) {
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(distortion);
          distortion.connect(biquadFilter);
          biquadFilter.connect(gainNode);
          convolver.connect(gainNode);
          gainNode.connect(analyser);
          analyser.connect(audioCtx.destination);

          visualize();
        })
      .catch(function (err) { console.log('The following gUM error occured: ' + err); })
  } else {
    console.log('getUserMedia not supported on your browser!');
  }

  function visualize() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;


    var visualSetting = visualSelect.value;
    console.log(visualSetting);
    analyser.fftSize = 1024;
    var bufferLengthAlt = analyser.frequencyBinCount;
    console.log(bufferLengthAlt);
    var dataArrayAlt = new Uint8Array(bufferLengthAlt);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    const maxFrequency = audioCtx.sampleRate / 2;

    const frequencyInterval = maxFrequency / analyser.fftSize;
    var bellA = new Bell(4737.3046875, 4823.4375, frequencyInterval * 2);
    var bellB = new Bell(5340.234375, 5383.30078125, frequencyInterval * 2);
    var drawAlt = function () {
      drawVisual = requestAnimationFrame(drawAlt);

      analyser.getByteFrequencyData(dataArrayAlt);

      const frequencyInterval = maxFrequency / dataArrayAlt.byteLength;
      if (true) {
        // TODO threshold and which frequencies
        // console.log("BELL");

        // TODO log active frequencies
        // console.log(audioCtx.sampleRate);
      }

      canvasCtx.fillStyle = 'rgb(0, 0, 0)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      var barWidth = (WIDTH / bufferLengthAlt) * 2.5;
      var barHeight;
      var x = 0;

      var activeFrequencies = "";
      for (var i = 0; i < bufferLengthAlt; i++) {
        barHeight = dataArrayAlt[i];
        if (dataArrayAlt[i] > 0.0 && (i + 1) * frequencyInterval > 3000.0) {
          bellA.setFrequencyBin(i);
          bellB.setFrequencyBin(i);
          activeFrequencies += (
            frequencyInterval * i).toString() +
            " - " +
            (frequencyInterval * (i + 1)).toString() +
            "\n";
        }

        canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2);

        x += barWidth + 1;
      }
      if (bellA.hasRang) {
        console.log("bell a has rang");
      }
      if (bellB.hasRang) {
        console.log("bell b has rang");
      }
      if (activeFrequencies.length > 0) {
        console.log(activeFrequencies);
      }
      bellA.reset();
      bellB.reset();
    };

    drawAlt();
  }
}

class Bell {
  constructor(frequencyStart, frequencyEnd, frequencyInterval) {
    this.frequencyStart = frequencyStart;
    this.frequencyEnd = frequencyEnd;
    this.bins = new Map();

    let i = frequencyStart / frequencyInterval;
    for (let f = frequencyStart; f < frequencyEnd; f += frequencyInterval) {
      this.bins.set(i, false);
      i += 1;
    }
  }

  get hasRang() {
    for (const value of this.bins.values()) {
      if (!value) {
        return false
      }
    }
    return true;
  }

  setFrequencyBin(i) {
    if (this.bins.get(i) != null) {
      this.bins.set(i, true);
    }
  }

  reset() {
    for (const key of this.bins.keys()) {
      this.bins.set(key, false);
    }
  }
}
