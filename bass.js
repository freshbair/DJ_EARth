/* Browser-synthesized Earth bass voice. No samples, downloads, or dependencies.
   Features resonant low-pass filter envelope and rich multi-oscillator harmonic layers
   for an authentic, punchy, deep plucked bass sound. */
(function (global) {
  'use strict';

  /**
   * ready() must be called from a user gesture before play(hz).
   * setVolume(0..1) controls every note equally and works before ready().
   * stopAll() immediately silences and releases every active note.
   * options.AudioContext may supply a context constructor for automated tests.
   */
  function createDJEarthBass(options = {}) {
    const MAX_GAIN = 0.28;
    const MAX_VOICES = 6;
    const TAIL_SECONDS = 1.1;

    let context;
    let master;
    let visualizer;
    let resumePromise;
    let volume = 0.55;
    const voices = new Set();

    function setVolume(value) {
      if (!Number.isFinite(value)) throw new TypeError('Volume must be a number.');
      volume = Math.max(0, Math.min(1, value));
      if (!master) return;
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      if (volume === 0) {
        master.gain.setValueAtTime(0, now);
      } else {
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(volume * MAX_GAIN, now + 0.02);
      }
      if (voices.size > 0) visualizer?.start();
    }

    async function ready() {
      if (!context) {
        const AudioContextClass = options.AudioContext || global.AudioContext || global.webkitAudioContext;
        if (!AudioContextClass) throw new Error('This browser does not support Web Audio.');
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = volume * MAX_GAIN;
        master.connect(context.destination);
        visualizer = global.DJEarthVisualizer?.connect(context, master);
      }
      if (context.state === 'closed') throw new Error('The audio context has been closed.');
      if (context.state !== 'running') {
        if (!resumePromise) {
          resumePromise = context.resume().finally(() => { resumePromise = undefined; });
        }
        await resumePromise;
      }
    }

    function stopVoice(voice) {
      if (voice.disposed) return;
      voice.disposed = true;
      voices.delete(voice);
      const now = context.currentTime;
      voice.nodes.forEach(node => {
        if (node.gain) {
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(0, now);
        }
        if (node.frequency && node.stops) {
          try { node.stop(now); } catch { /* Already stopped */ }
        }
        try { node.disconnect(); } catch { /* Ignore */ }
      });
    }

    function stopAll() {
      [...voices].forEach(stopVoice);
      visualizer?.stop();
    }

    function play(hz) {
      if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Pitch must be a positive frequency.');
      if (!context || context.state !== 'running') throw new Error('Call ready() before playing a note.');
      if (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);

      const now = context.currentTime;
      const voice = { nodes: [], disposed: false };
      voices.add(voice);

      try {
        // Voice filter: resonant lowpass with snappy pluck decay
        let filter;
        if (typeof context.createBiquadFilter === 'function') {
          filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = 3.6;
          // Pluck sweep: opens on the finger pluck and quickly sweeps down to the warm bass body
          const startCutoff = Math.min(2600, Math.max(1000, hz * 10));
          const bodyCutoff = Math.min(420, Math.max(150, hz * 2.0));
          filter.frequency.setValueAtTime(startCutoff, now);
          filter.frequency.exponentialRampToValueAtTime(bodyCutoff, now + 0.14);
          filter.frequency.linearRampToValueAtTime(Math.max(70, hz * 1.1), now + TAIL_SECONDS);
          filter.connect(master);
          voice.nodes.push(filter);
        } else {
          filter = master;
        }

        // Voice master envelope
        const voiceGain = context.createGain();
        voiceGain.gain.setValueAtTime(0, now);
        voiceGain.gain.linearRampToValueAtTime(1.0, now + 0.007); // Snappy 7ms attack
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + TAIL_SECONDS - 0.05);
        voiceGain.gain.linearRampToValueAtTime(0, now + TAIL_SECONDS);
        voiceGain.connect(filter);
        voice.nodes.push(voiceGain);

        // Layer 1: Sub/Fundamental warm sine (deep low-end weight)
        const subOsc = context.createOscillator();
        const subGain = context.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(hz, now);
        subGain.gain.setValueAtTime(0.75, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + TAIL_SECONDS * 0.9);
        subOsc.connect(subGain);
        subGain.connect(voiceGain);
        voice.nodes.push(subOsc, subGain);

        // Layer 2: Plucked body (sawtooth for rich harmonic body through resonant filter)
        const sawOsc = context.createOscillator();
        const sawGain = context.createGain();
        sawOsc.type = 'sawtooth';
        // Subtle micro-pitch drop on string hit (gives authentic physical string snap)
        sawOsc.frequency.setValueAtTime(hz * 1.025, now);
        sawOsc.frequency.exponentialRampToValueAtTime(hz, now + 0.02);
        sawGain.gain.setValueAtTime(0.55, now);
        sawGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
        sawOsc.connect(sawGain);
        sawGain.connect(voiceGain);
        voice.nodes.push(sawOsc, sawGain);

        // Layer 3: Triangle body (adds punchy mid-bass warmth)
        const triOsc = context.createOscillator();
        const triGain = context.createGain();
        triOsc.type = 'triangle';
        triOsc.frequency.setValueAtTime(hz, now);
        triGain.gain.setValueAtTime(0.40, now);
        triGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.70);
        triOsc.connect(triGain);
        triGain.connect(voiceGain);
        voice.nodes.push(triOsc, triGain);

        // Layer 4: Upper presence octave (sine at 2*hz for small speakers / headphones)
        const harmOsc = context.createOscillator();
        const harmGain = context.createGain();
        harmOsc.type = 'sine';
        harmOsc.frequency.setValueAtTime(hz * 2, now);
        harmGain.gain.setValueAtTime(0.20, now);
        harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        harmOsc.connect(harmGain);
        harmGain.connect(voiceGain);
        voice.nodes.push(harmOsc, harmGain);

        // Start and stop all oscillators
        const oscillators = [subOsc, sawOsc, triOsc, harmOsc];
        let remaining = oscillators.length;
        oscillators.forEach(osc => {
          osc.onended = () => {
            if (voice.disposed) return;
            try { osc.disconnect(); } catch { /* Ignore */ }
            remaining--;
            if (remaining === 0) {
              voice.disposed = true;
              voices.delete(voice);
            }
          };
          osc.start(now);
          osc.stop(now + TAIL_SECONDS);
        });
        visualizer?.start();
      } catch (error) {
        stopVoice(voice);
        throw error;
      }
    }

    setVolume(options.volume === undefined ? 0.55 : options.volume);
    return Object.freeze({ ready, play, setVolume, stopAll, tailSeconds: TAIL_SECONDS });
  }

  global.createDJEarthBass = createDJEarthBass;
})(globalThis);
