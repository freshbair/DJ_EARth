/* Audio-reactive spectrum and waveform display for the studio's own output. */
(function (global) {
  'use strict';

  const bars = [...(global.document?.querySelectorAll('.equalizer i') || [])];
  const motion = global.matchMedia?.('(prefers-reduced-motion: reduce)');
  const connections = new WeakMap();
  const active = new Set();
  const levels = new Float32Array(bars.length);
  const targets = new Float32Array(bars.length);
  const BASELINE = 0.055;
  let frame;
  let lastTime;

  function paint() {
    bars.forEach((bar, index) => {
      bar.style.transform = `scaleY(${BASELINE + (1 - BASELINE) * levels[index]})`;
    });
  }

  function reset() {
    if (frame !== undefined) global.cancelAnimationFrame(frame);
    frame = undefined;
    lastTime = undefined;
    levels.fill(0);
    paint();
  }

  function schedule() {
    if (frame === undefined && active.size && !global.document.hidden && !motion?.matches) {
      frame = global.requestAnimationFrame(draw);
    }
  }

  function draw(time) {
    frame = undefined;
    const elapsed = lastTime === undefined ? 16 : Math.min(64, time - lastTime);
    lastTime = time;
    targets.fill(0);

    active.forEach(entry => {
      const { context, analyser, spectrum, waveform, bands } = entry;
      if (context.state !== 'running') {
        active.delete(entry);
        return;
      }
      try {
        analyser.getFloatTimeDomainData(waveform);
        let energy = 0;
        for (const value of waveform) energy += value * value;
        // Gate residual FFT history after an exact mute or the end of a note.
        const rms = Math.sqrt(energy / waveform.length);
        if (rms > 0.0001) {
          entry.silentSince = undefined;
          analyser.getFloatFrequencyData(spectrum);
          let strongestBin = 1;
          for (let bin = 2; bin < spectrum.length; bin++) {
            if (spectrum[bin] > spectrum[strongestBin]) strongestBin = bin;
          }
          // Simple instrument tones occupy only a few frequency bands. Spread
          // their real waveform across the display so every bar participates.
          // A short, pitch-relative window keeps its shape legible at any octave.
          const span = Math.min(waveform.length, Math.max(bars.length * 4,
            Math.round(2.5 * analyser.fftSize / strongestBin)));
          const startSample = waveform.length - span;
          const body = Math.min(1, Math.sqrt(rms * 16));
          bands.forEach(([first, end], index) => {
            let peak = -Infinity;
            for (let bin = first; bin < end; bin++) peak = Math.max(peak, spectrum[bin]);
            // Convert dB to amplitude, then compress for a legible display.
            // Keep absolute levels: turning down volume really lowers the bars.
            const spectralLevel = Math.min(1, Math.sqrt(16 * 10 ** (peak / 20)));
            const from = startSample + Math.floor(index * span / bars.length);
            const to = startSample + Math.floor((index + 1) * span / bars.length);
            let localEnergy = 0;
            for (let sample = from; sample < to; sample++) localEnergy += waveform[sample] ** 2;
            const waveLevel = Math.min(1, Math.sqrt(localEnergy / (to - from)) / (rms * Math.SQRT2));
            // The full display follows loudness and note envelopes; waveform
            // detail and spectral peaks give individual bars their own movement.
            const level = Math.min(1, spectralLevel * 0.45 + body * (0.24 + 0.66 * waveLevel));
            targets[index] = Math.max(targets[index], level);
          });
        } else {
          entry.silentSince ??= time;
          if (time - entry.silentSince > 350) active.delete(entry);
        }
      } catch {
        // A closed or unavailable analyser must never interrupt playback.
        active.delete(entry);
      }
    });

    levels.forEach((level, index) => {
      const response = targets[index] > level ? 35 : 100;
      levels[index] += (targets[index] - level) * (1 - Math.exp(-elapsed / response));
    });
    paint();
    if (active.size) schedule();
    else reset();
  }

  function connect(context, output) {
    if (!bars.length || typeof context?.createAnalyser !== 'function' || !global.requestAnimationFrame) return;
    if (connections.has(output)) return connections.get(output);
    let analyser;
    try {
      analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      const binHz = context.sampleRate / analyser.fftSize;
      const upperHz = Math.min(12000, context.sampleRate / 2);
      const bands = bars.map((_, index) => {
        const lower = 40 * (upperHz / 40) ** (index / bars.length);
        const upper = 40 * (upperHz / 40) ** ((index + 1) / bars.length);
        const first = Math.max(1, Math.floor(lower / binHz));
        const end = Math.min(analyser.frequencyBinCount, Math.max(first + 1, Math.ceil(upper / binHz)));
        return [first, end];
      });
      // Read post-volume audio on a separate branch. The audible path stays intact.
      output.connect(analyser);
      const entry = {
        context, analyser, bands,
        spectrum: new Float32Array(analyser.frequencyBinCount),
        waveform: new Float32Array(analyser.fftSize),
        silentSince: undefined
      };
      const handle = Object.freeze({
        start() {
          entry.silentSince = undefined;
          active.add(entry);
          schedule();
        },
        stop() {
          active.delete(entry);
          if (!active.size) reset();
        }
      });
      connections.set(output, handle);
      return handle;
    } catch {
      analyser?.disconnect();
    }
  }

  global.document?.addEventListener('visibilitychange', () => {
    if (global.document.hidden) reset();
    else schedule();
  });
  motion?.addEventListener('change', () => {
    if (motion.matches) reset();
    else schedule();
  });
  global.addEventListener('pagehide', () => {
    active.clear();
    reset();
  });

  paint();
  global.DJEarthVisualizer = Object.freeze({ connect });
})(globalThis);
