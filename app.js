let heading = document.querySelector('h1');
heading.textContent = 'CLICK ANYWHERE TO START'
document.body.addEventListener('click', start);

function unixTimestampInSecs() {
  return Math.floor(Date.now() / 1000);
}

class Bell {
  constructor(frequencyStart, frequencyEnd, frequencyInterval) {
    this.frequencyStart = frequencyStart;
    this.frequencyEnd = frequencyEnd;
    this.bins = new Map();
    this.lastRang = 0;

    let i = frequencyStart / frequencyInterval;
    for (let f = frequencyStart; f < frequencyEnd; f += frequencyInterval) {
      this.bins.set(i, false);
      i += 1;
    }
  }

  get hasRang() {
    const now = unixTimestampInSecs();
    if ((now - this.lastRang) < 10) {
      return false;
    }
    for (const value of this.bins.values()) {
      if (!value) {
        return false
      }
    }
    this.lastRang = now;
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

class BellDetectionService {
  constructor() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.intervalID = 0;
  }

  start() {
    heading.textContent = 'Voice-change-O-matic';
    document.body.removeEventListener('click', start)

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

    var audioCtx = this.audioCtx;
    var source;

    var analyser = audioCtx.createAnalyser();
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;

    var distortion = audioCtx.createWaveShaper();
    var gainNode = audioCtx.createGain();
    var biquadFilter = audioCtx.createBiquadFilter();
    var convolver = audioCtx.createConvolver();

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

            run();
          })
        .catch(function (err) { console.log('The following gUM error occured: ' + err); })
    } else {
      console.log('getUserMedia not supported on your browser!');
    }

    var self = this;

    function run() {
      analyser.fftSize = 1024;
      var bufferLengthAlt = analyser.frequencyBinCount;
      var dataArrayAlt = new Uint8Array(bufferLengthAlt);

      const maxFrequency = audioCtx.sampleRate / 2;

      const frequencyInterval = maxFrequency / analyser.fftSize;
      var bellA = new Bell(4737.3046875, 4823.4375, frequencyInterval * 2);
      var bellB = new Bell(5340.234375, 5383.30078125, frequencyInterval * 2);
      var detectBells = function () {
        console.log("here");
        analyser.getByteFrequencyData(dataArrayAlt);

        const frequencyInterval = maxFrequency / dataArrayAlt.byteLength;

        var activeFrequencies = "";
        for (var i = 0; i < bufferLengthAlt; i++) {
          if (dataArrayAlt[i] > 0.0 && (i + 1) * frequencyInterval > 3000.0) {
            bellA.setFrequencyBin(i);
            bellB.setFrequencyBin(i);
            activeFrequencies += (
              frequencyInterval * i).toString() +
              " - " +
              (frequencyInterval * (i + 1)).toString() +
              "\n";
          }
        }
        if (bellA.hasRang) {
          console.log("bell a has rang");
        }
        if (bellB.hasRang) {
          console.log("bell b has rang");
        }
        // if (activeFrequencies.length > 0) {
        //   console.log(activeFrequencies);
        // }
        bellA.reset();
        bellB.reset();
      };

      self.intervalID = setInterval(detectBells, 10);
    }
  }

  stop() {
    if (this.intervalID != 0) {
      clearInterval(this.intervalID);
      this.audioCtx.close();
    }
  }
}

function start() {
  var bellDetectionService = new BellDetectionService();
  // setTimeout(function () {
  //   bellDetectionService.stop();
  // }, 3000);
  bellDetectionService.start();
}
