/* Local synthesized instrument approximations for isolated parameter tests. */
(function (global) {
  'use strict';
  const assignments = Object.freeze([
    { parameter: 'Nightlight', instrument: 'Piano', id: 'piano', octave: 4 },
    { parameter: 'Temperature', instrument: 'Harmonica', id: 'harmonica', octave: 4 },
    { parameter: 'Air quality', instrument: 'Flute', id: 'flute', octave: 5 },
    { parameter: 'Storms', instrument: 'Electric guitar', id: 'guitar', octave: 3 },
    { parameter: 'Ocean currents', instrument: 'Harp', id: 'harp', octave: 4 },
    { parameter: 'Wind speed', instrument: 'Drums', id: 'drums', octave: 2 },
    { parameter: 'Hurricane', instrument: 'Violin', id: 'violin', octave: 4 },
    { parameter: 'Altitude', instrument: 'Bass', id: 'bass', octave: 2 }
  ].map(Object.freeze));
  const profiles = {
    harmonica: { wave: 'square', partials: [0.65, 0.22, 0.1], attack: 0.035, cutoff: 3200 },
    flute: { wave: 'sine', partials: [1, 0.09, 0.025], attack: 0.065, cutoff: 5500 },
    guitar: { wave: 'sawtooth', partials: [0.65, 0.2, 0.08], attack: 0.006, cutoff: 2400, pluck: true },
    harp: { wave: 'sine', partials: [0.85, 0.3, 0.12, 0.05], attack: 0.004, cutoff: 6000, pluck: true },
    violin: { wave: 'sawtooth', partials: [0.7, 0.15], attack: 0.13, cutoff: 4500 }
  };
  function createInstrument(id, options = {}) {
    if (id === 'piano') return global.createDJEarthPiano(options);
    if (id === 'bass') return global.createDJEarthBass(options);
    if (!profiles[id] && id !== 'drums') throw new RangeError('Unknown instrument.');
    let context, master, visualizer;
    let volume = options.volume ?? 0.55;
    const voices = new Set();
    function setVolume(value) {
      if (!Number.isFinite(value)) throw new TypeError('Volume must be a number.');
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.setValueAtTime(volume * 0.18, context.currentTime);
      if (voices.size > 0) visualizer?.start();
    }
    async function ready() {
      if (!context) {
        const Context = options.AudioContext || global.AudioContext || global.webkitAudioContext;
        if (!Context) throw new Error('This browser does not support Web Audio.');
        context = new Context();
        master = context.createGain();
        master.connect(context.destination);
        visualizer = global.DJEarthVisualizer?.connect(context, master);
        setVolume(volume);
      }
      if (context.state !== 'running') await context.resume();
    }
    function dispose(voice) {
      if (!voices.delete(voice)) return;
      voice.sources.forEach(source => { try { source.stop(); } catch {} });
      voice.nodes.forEach(node => node.disconnect());
    }
    function stopAll() {
      [...voices].forEach(dispose);
      visualizer?.stop();
    }
    function play(hz) {
      if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Pitch must be positive.');
      if (!context || context.state !== 'running') throw new Error('Call ready() first.');
      if (voices.size >= 6) dispose(voices.values().next().value);
      const now = context.currentTime;
      const voice = { sources: [], nodes: [] };
      voices.add(voice);
      const profile = profiles[id];
      const duration = id === 'drums' ? 0.4 : 0.95;
      const envelope = context.createGain();
      voice.nodes.push(envelope);
      envelope.connect(master);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.8, now + (profile?.attack || 0.003));
      if (profile && !profile.pluck) {
        envelope.gain.linearRampToValueAtTime(0.55, now + 0.55);
      }
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = profile?.cutoff || 6500;
      filter.connect(envelope);
      voice.nodes.push(filter);
      function add(source, gain) {
        const level = context.createGain();
        level.gain.value = gain;
        source.connect(level);
        level.connect(filter);
        voice.sources.push(source);
        voice.nodes.push(source, level);
      }
      if (id === 'drums') {
        // Low values produce a kick; middle values a snare; high values a hi-hat.
        const kick = hz < 95;
        const hat = hz > 120;
        if (kick) {
          const tone = context.createOscillator();
          tone.frequency.setValueAtTime(150, now);
          tone.frequency.exponentialRampToValueAtTime(45, now + 0.2);
          add(tone, 1);
        } else {
          const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (context.sampleRate * (hat ? 0.035 : 0.09)));
          const noise = context.createBufferSource();
          noise.buffer = buffer;
          filter.type = 'highpass';
          filter.frequency.value = hat ? 7000 : 1000;
          add(noise, 0.8);
        }
      } else {
        profile.partials.forEach((gain, index) => {
          const tone = context.createOscillator();
          tone.type = profile.wave;
          tone.frequency.value = hz * (index + 1);
          add(tone, gain);
        });
      }
      let remaining = voice.sources.length;
      voice.sources.forEach(source => {
        source.onended = () => { if (--remaining === 0) dispose(voice); };
        source.start(now);
        source.stop(now + duration);
      });
      visualizer?.start();
    }
    setVolume(volume);
    return Object.freeze({ ready, play, setVolume, stopAll, tailSeconds: 0.95 });
  }
  global.DJEarthInstruments = Object.freeze({ assignments, createInstrument });
})(globalThis);
