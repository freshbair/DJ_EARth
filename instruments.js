/* Local sample-based harmonica, guitar, harp and violin; synthesized remaining voices. */
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
    flute: { wave: 'sine', partials: [1, 0.09, 0.025], attack: 0.065, cutoff: 5500 }
  };
  const sampled = new Set(['harmonica', 'guitar', 'harp', 'violin']);
  const bankLoads = new Map();
  const decodedBanks = new Map();
  const assetBase = new URL('assets/instruments/', document.currentScript?.src || document.baseURI);
  function loadBank(id, context) {
    if (!bankLoads.has(id)) {
      const promise = new Promise((resolve, reject) => {
        if (global.DJEarthSampleData?.[id]) { resolve(); return; }
        const script = document.createElement('script');
        script.src = new URL(`${id}.js`, assetBase).href;
        script.onload = () => { script.remove(); global.DJEarthSampleData?.[id] ? resolve() : reject(new Error(`Missing ${id} samples.`)); };
        script.onerror = () => { script.remove(); reject(new Error(`Could not load ${id} samples. Please retry.`)); };
        document.head.append(script);
      }).catch(error => { bankLoads.delete(id); throw error; });
      bankLoads.set(id, promise);
    }
    if (!decodedBanks.has(id)) {
      const promise = bankLoads.get(id).then(async () => {
        const entries = await Promise.all(Object.entries(global.DJEarthSampleData[id]).map(async ([midi, uri]) => {
          const binary = atob(uri.slice(uri.indexOf(',') + 1));
          const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
          return [Number(midi), await context.decodeAudioData(bytes.buffer)];
        }));
        return new Map(entries);
      }).catch(error => { decodedBanks.delete(id); throw error; });
      decodedBanks.set(id, promise);
    }
    return decodedBanks.get(id);
  }
  function createSampleInstrument(id, options) {
    let context, master, visualizer, bank;
    let volume = options.volume ?? 0.55;
    const voices = new Set();
    const tailSeconds = id === 'harp' || id === 'guitar' ? 2.4 : 1.05;
    function setVolume(value) {
      if (!Number.isFinite(value)) throw new TypeError('Volume must be a number.');
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.setValueAtTime(volume * 0.65, context.currentTime);
      if (voices.size) visualizer?.start();
    }
    async function ready() {
      if (!context) {
        const Context = options.AudioContext || global.AudioContext || global.webkitAudioContext;
        if (!Context) throw new Error('This browser does not support Web Audio.');
        context = new Context();
        master = context.createGain(); master.connect(context.destination);
        visualizer = global.DJEarthVisualizer?.connect(context, master);
        setVolume(volume);
      }
      // Resume inside the user gesture while local samples decode in parallel.
      const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      [bank] = await Promise.all([loadBank(id, context), resumed]);
    }
    function dispose(voice) {
      if (!voices.delete(voice)) return;
      voice.source.onended = null;
      try { voice.source.stop(); } catch {}
      voice.source.disconnect(); voice.gain.disconnect();
    }
    function stopAll() {
      [...voices].forEach(dispose);
      visualizer?.stop();
    }
    function play(hz) {
      if (!Number.isFinite(hz) || hz <= 0) throw new RangeError('Pitch must be positive.');
      if (!bank || context.state !== 'running') throw new Error('Call ready() first.');
      if (voices.size >= 8) dispose(voices.values().next().value);
      const midi = 69 + 12 * Math.log2(hz / 440);
      const nearest = [...bank.keys()].reduce((best, n) => Math.abs(n - midi) < Math.abs(best - midi) ? n : best);
      const source = context.createBufferSource();
      source.buffer = bank.get(nearest);
      source.playbackRate.value = 2 ** ((midi - nearest) / 12);
      const gain = context.createGain();
      source.connect(gain); gain.connect(master);
      const now = context.currentTime;
      const duration = Math.min(tailSeconds, source.buffer.duration / source.playbackRate.value);
      // Preserve the recorded attack and decay; fade only at the end to avoid a cut.
      gain.gain.setValueAtTime(1, now);
      gain.gain.setValueAtTime(1, now + Math.max(0, duration - 0.12));
      gain.gain.linearRampToValueAtTime(0, now + duration);
      const voice = { source, gain }; voices.add(voice);
      source.onended = () => dispose(voice);
      source.start(now); source.stop(now + duration);
      visualizer?.start();
    }
    setVolume(volume);
    return Object.freeze({ ready, play, setVolume, stopAll, tailSeconds });
  }
  function createInstrument(id, options = {}) {
    if (id === 'piano') return global.createDJEarthPiano(options);
    if (id === 'bass') return global.createDJEarthBass(options);
    if (sampled.has(id)) return createSampleInstrument(id, options);
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
