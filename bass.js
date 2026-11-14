/* Browser-synthesized temperature → Earth bass voice. No samples, downloads, or dependencies. */
(function (global) {
  'use strict';

  /**
   * ready() must be called from a user gesture before play(hz).
   * setVolume(0..1) controls every note equally and works before ready().
   * stopAll() immediately silences and releases every active note.
   * options.AudioContext may supply a context constructor for automated tests.
   */
  function createDJEarthBass(options = {}) {
    const MAX_GAIN = 0.22;
    const MAX_VOICES = 6;
    const TAIL_SECONDS = 0.95;
    // Harmonic partials designed for deep, warm, resonant Earth planetary bass
    const PARTIALS = [
      { harmonic: 1, type: 'sine', amplitude: 0.80, decay: 0.90 },
      { harmonic: 1, type: 'triangle', amplitude: 0.25, decay: 0.65 },
      { harmonic: 2, type: 'sine', amplitude: 0.18, decay: 0.45 },
      { harmonic: 3, type: 'sine', amplitude: 0.07, decay: 0.25 }
    ];
    let context;
    let master;
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
    }

    async function ready() {
      if (!context) {
        const AudioContextClass = options.AudioContext || global.AudioContext || global.webkitAudioContext;
        if (!AudioContextClass) throw new Error('This browser does not support Web Audio.');
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = volume * MAX_GAIN;
        master.connect(context.destination);
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
      voice.parts.forEach(({ tone, envelope }) => {
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setValueAtTime(0, now);
        try { tone.stop(now); } catch { /* A previously ended source needs no stop. */ }
        tone.disconnect();
        envelope.disconnect();
      });
    }

    function stopAll() {
      [...voices].forEach(stopVoice);
    }

    function play(hz) {
      if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Pitch must be a positive frequency.');
      if (!context || context.state !== 'running') throw new Error('Call ready() before playing a note.');
      if (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);

      const now = context.currentTime;
      const voice = { parts: [], remaining: PARTIALS.length, disposed: false };
      voices.add(voice);

      try {
        PARTIALS.forEach(({ harmonic, type, amplitude, decay }) => {
          const tone = context.createOscillator();
          const envelope = context.createGain();
          voice.parts.push({ tone, envelope });
          tone.type = type || 'sine';
          tone.frequency.value = hz * harmonic;
          tone.connect(envelope);
          envelope.connect(master);

          // Fast plucked attack and smooth resonant release
          envelope.gain.setValueAtTime(0, now);
          envelope.gain.linearRampToValueAtTime(amplitude, now + 0.008);
          envelope.gain.exponentialRampToValueAtTime(0.0001, now + decay);
          envelope.gain.linearRampToValueAtTime(0, now + TAIL_SECONDS);

          tone.onended = () => {
            if (voice.disposed) return;
            tone.disconnect();
            envelope.disconnect();
            voice.remaining--;
            if (voice.remaining === 0) {
              voice.disposed = true;
              voices.delete(voice);
            }
          };
          tone.start(now);
          tone.stop(now + TAIL_SECONDS);
        });
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
