/* Pure image-to-note logic for the temperature → bass layer.
   No canvas, audio, or DOM state lives here, so future layers can stay separate. */
(function (root) {
  'use strict';

  const names = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

  // Deep Bass Octave (C2–B2: 65.4 Hz to 123.5 Hz) - Standard electric/acoustic bass range
  const deepBassPitches = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2'];
  const deepBassMidi = [36, 38, 40, 41, 43, 45, 47];
  const DEEP_BASS_NOTES = Object.freeze(names.map((name, index) => Object.freeze({
    name, pitch: deepBassPitches[index], hz: 440 * 2 ** ((deepBassMidi[index] - 69) / 12)
  })));
  const HIGH_DO_DEEP_BASS = Object.freeze({ name: 'Do', pitch: 'C3', hz: DEEP_BASS_NOTES[0].hz * 2 });

  // Tenor Bass Octave (C3–B3: 130.8 Hz to 246.9 Hz)
  const tenorBassPitches = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3'];
  const tenorBassMidi = [48, 50, 52, 53, 55, 57, 59];
  const TENOR_BASS_NOTES = Object.freeze(names.map((name, index) => Object.freeze({
    name, pitch: tenorBassPitches[index], hz: 440 * 2 ** ((tenorBassMidi[index] - 69) / 12)
  })));
  const HIGH_DO_TENOR_BASS = Object.freeze({ name: 'Do', pitch: 'C4', hz: TENOR_BASS_NOTES[0].hz * 2 });

  // Piano Octave (C4–B4: 261.6 Hz to 493.9 Hz)
  const pianoPitches = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
  const pianoMidi = [60, 62, 64, 65, 67, 69, 71];
  const PIANO_NOTES = Object.freeze(names.map((name, index) => Object.freeze({
    name, pitch: pianoPitches[index], hz: 440 * 2 ** ((pianoMidi[index] - 69) / 12)
  })));
  const HIGH_DO_PIANO = Object.freeze({ name: 'Do', pitch: 'C5', hz: PIANO_NOTES[0].hz * 2 });

  // Standard scientific temperature colormap reference keys (Navy to Maroon, 0 to 6)
  const THERMAL_KEYS = Object.freeze([
    Object.freeze({ t: 0.0, r: 7,   g: 11,  b: 141 }), // 0.0: Dark Navy (coldest)
    Object.freeze({ t: 0.5, r: 17,  g: 21,  b: 240 }), // 0.5: Deep Blue
    Object.freeze({ t: 1.0, r: 10,  g: 63,  b: 255 }), // 1.0: Blue
    Object.freeze({ t: 1.5, r: 16,  g: 159, b: 255 }), // 1.5: Sky Blue
    Object.freeze({ t: 2.0, r: 21,  g: 255, b: 254 }), // 2.0: Cyan
    Object.freeze({ t: 2.5, r: 32,  g: 250, b: 233 }), // 2.5: Aqua / Mint
    Object.freeze({ t: 3.0, r: 95,  g: 253, b: 160 }), // 3.0: Light Green
    Object.freeze({ t: 3.5, r: 172, g: 254, b: 81  }), // 3.5: Yellow-Green
    Object.freeze({ t: 4.0, r: 253, g: 240, b: 22  }), // 4.0: Yellow
    Object.freeze({ t: 4.5, r: 255, g: 142, b: 12  }), // 4.5: Orange
    Object.freeze({ t: 5.0, r: 252, g: 46,  b: 22  }), // 5.0: Red
    Object.freeze({ t: 5.5, r: 221, g: 18,  b: 21  }), // 5.5: Crimson
    Object.freeze({ t: 6.0, r: 127, g: 16,  b: 9   })  // 6.0: Dark Maroon (hottest)
  ]);

  // Test pattern values (0 to 6 and back to 0 for phrase ending)
  const TEST_TEMPS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 0]);

  // Representative RGB colors for the 8 test pattern blocks
  const TEST_COLORS = Object.freeze([
    Object.freeze({ r: 7,   g: 11,  b: 141 }), // 0: Dark Navy (Do)
    Object.freeze({ r: 10,  g: 63,  b: 255 }), // 1: Blue (Ré)
    Object.freeze({ r: 21,  g: 255, b: 254 }), // 2: Cyan (Mi)
    Object.freeze({ r: 95,  g: 253, b: 160 }), // 3: Green (Fa)
    Object.freeze({ r: 253, g: 240, b: 22  }), // 4: Yellow (Sol)
    Object.freeze({ r: 252, g: 46,  b: 22  }), // 5: Red (La)
    Object.freeze({ r: 127, g: 16,  b: 9   }), // 6: Dark Maroon (Si)
    Object.freeze({ r: 7,   g: 11,  b: 141 })  // 7: Dark Navy (High Do)
  ]);

  function getNotes(instrument = 'bass') {
    if (instrument === 'piano') return PIANO_NOTES;
    if (instrument === 'tenor-bass') return TENOR_BASS_NOTES;
    return DEEP_BASS_NOTES;
  }

  function getHighDo(instrument = 'bass') {
    if (instrument === 'piano') return HIGH_DO_PIANO;
    if (instrument === 'tenor-bass') return HIGH_DO_TENOR_BASS;
    return HIGH_DO_DEEP_BASS;
  }

  function validateImage(image) {
    if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
        image.width < 1 || image.height < 1 || !image.data ||
        image.data.length < image.width * image.height * 4) {
      throw new TypeError('Expected a nonempty RGBA image grid.');
    }
  }

  function isRestPixel(r, g, b, a = 255) {
    if (a === 0) return true;
    // Pure off-map white background in projected planetary maps (outside the globe)
    if (r >= 250 && g >= 250 && b >= 250) return true;
    return false;
  }

  function temperatureFromRGB(r, g, b) {
    const maxVal = Math.max(r, g, b);
    const minVal = Math.min(r, g, b);
    const saturation = maxVal - minVal;

    // Grayscale / infrared images: map brightness linearly to 0..6
    if (saturation < 14) {
      const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return Math.round((brightness / 255 * 6) * 100) / 100;
    }

    // Piecewise projection onto the thermal colormap spline
    let bestDist = Infinity;
    let bestT = 0;

    for (let i = 0; i < THERMAL_KEYS.length - 1; i++) {
      const k0 = THERMAL_KEYS[i];
      const k1 = THERMAL_KEYS[i + 1];
      const dr = k1.r - k0.r;
      const dg = k1.g - k0.g;
      const db = k1.b - k0.b;
      const segLen2 = dr * dr + dg * dg + db * db;
      if (segLen2 === 0) continue;

      const vr = r - k0.r;
      const vg = g - k0.g;
      const vb = b - k0.b;
      const dot = vr * dr + vg * dg + vb * db;
      const frac = Math.max(0, Math.min(1, dot / segLen2));

      const projR = k0.r + frac * dr;
      const projG = k0.g + frac * dg;
      const projB = k0.b + frac * db;
      const dist = Math.sqrt((r - projR) ** 2 + (g - projG) ** 2 + (b - projB) ** 2);

      if (dist < bestDist) {
        bestDist = dist;
        bestT = k0.t + frac * (k1.t - k0.t);
      }
    }

    return Math.round(Math.max(0, Math.min(6, bestT)) * 100) / 100;
  }

  function temperatureLabel(t) {
    if (t === null || t === undefined) return 'Rest';
    if (t < 0.7) return 'Freezing';
    if (t < 1.7) return 'Cold';
    if (t < 2.7) return 'Cool';
    if (t < 3.7) return 'Mild';
    if (t < 4.7) return 'Warm';
    if (t < 5.5) return 'Hot';
    return 'Scorching';
  }

  function createTestPattern() {
    const width = 800;
    const height = 160;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const color = TEST_COLORS[Math.floor(x / 100)];
        data[offset] = color.r;
        data[offset + 1] = color.g;
        data[offset + 2] = color.b;
        data[offset + 3] = 255;
      }
    }
    return { width, height, data };
  }

  function colorRGBForTemperature(temp) {
    const t = Math.max(0, Math.min(6, temp));
    for (let i = 0; i < THERMAL_KEYS.length - 1; i++) {
      const k0 = THERMAL_KEYS[i];
      const k1 = THERMAL_KEYS[i + 1];
      if (t >= k0.t && t <= k1.t) {
        const frac = (t - k0.t) / (k1.t - k0.t);
        return {
          r: Math.round(k0.r + frac * (k1.r - k0.r)),
          g: Math.round(k0.g + frac * (k1.g - k0.g)),
          b: Math.round(k0.b + frac * (k1.b - k0.b))
        };
      }
    }
    return { r: 127, g: 16, b: 9 };
  }

  // Generates a self-contained planetary thermal map that never fails or taints in file:// mode
  function createEarthThermalMap() {
    const width = 800;
    const height = 400;
    const data = new Uint8ClampedArray(width * height * 4);
    const cx = width / 2;
    const cy = height / 2;
    const rx = width * 0.44;
    const ry = height * 0.44;

    for (let y = 0; y < height; y++) {
      const dy = (y - cy) / ry;
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const offset = (y * width + x) * 4;

        // Elliptical projection boundary
        if (dx * dx + dy * dy > 1.0) {
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
          data[offset + 3] = 255;
          continue;
        }

        // Planetary thermal distribution:
        // Hot tropical belt at equator (y=cy), freezing poles (y=0, y=height)
        const latNorm = Math.abs(dy); // 0 at equator, 1 at poles
        // Temperature index: 5.7 at equator down to 0.1 at poles, plus longitudinal waves
        const wave = 0.4 * Math.sin(dx * 6) + 0.25 * Math.cos(dy * 5 + dx * 3);
        const temp = Math.max(0, Math.min(6, (1 - latNorm ** 1.3) * 5.6 + wave));
        const color = colorRGBForTemperature(temp);

        data[offset] = color.r;
        data[offset + 1] = color.g;
        data[offset + 2] = color.b;
        data[offset + 3] = 255;
      }
    }
    return { width, height, data };
  }

  function scanSpots(image, customSpots = null) {
    validateImage(image);
    if (Array.isArray(customSpots) && customSpots.length === 8) {
      return customSpots.map((spot, index) => {
        const x = Math.max(0, Math.min(image.width - 1, Math.round(spot.x)));
        const y = Math.max(0, Math.min(image.height - 1, Math.round(spot.y)));
        const offset = (y * image.width + x) * 4;
        const r = image.data[offset];
        const g = image.data[offset + 1];
        const b = image.data[offset + 2];
        const a = image.data[offset + 3];
        const rest = isRestPixel(r, g, b, a);
        const temperature = rest ? null : temperatureFromRGB(r, g, b);
        return {
          index, x, y, rest, r, g, b, temperature,
          label: spot.label || null
        };
      });
    }

    const y = Math.floor(image.height / 2);
    return Array.from({ length: 8 }, (_, index) => {
      const x = Math.min(image.width - 1, Math.floor((index + 0.5) * image.width / 8));
      const offset = (y * image.width + x) * 4;
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const a = image.data[offset + 3];
      const rest = isRestPixel(r, g, b, a);
      const temperature = rest ? null : temperatureFromRGB(r, g, b);
      return {
        index, x, y, rest, r, g, b, temperature,
        label: null
      };
    });
  }

  function nearestCenter(value, centers) {
    let best = 0;
    let distance = Infinity;
    centers.forEach((center, index) => {
      const candidate = Math.abs(value - center);
      if (candidate < distance) {
        best = index;
        distance = candidate;
      }
    });
    return best;
  }

  function learnTemperatureGroups(image, maxSamples = 32768) {
    validateImage(image);
    const pixels = image.width * image.height;
    const requested = Number.isFinite(maxSamples) ? Math.floor(maxSamples) : 32768;
    const sampleCount = Math.min(pixels, Math.max(1, requested));

    const rows = Math.min(image.height, sampleCount,
      Math.max(1, Math.round(Math.sqrt(sampleCount * image.height / image.width))));
    const columns = Math.min(image.width, Math.max(1, Math.floor(sampleCount / rows)));

    const bins = new Uint32Array(61);
    for (let row = 0; row < rows; row++) {
      const y = Math.floor((row + 0.5) * image.height / rows);
      for (let column = 0; column < columns; column++) {
        const x = Math.floor((column + 0.5) * image.width / columns);
        const offset = (y * image.width + x) * 4;
        const r = image.data[offset];
        const g = image.data[offset + 1];
        const b = image.data[offset + 2];
        const a = image.data[offset + 3];
        if (isRestPixel(r, g, b, a)) continue;
        const temp = temperatureFromRGB(r, g, b);
        const binIndex = Math.max(0, Math.min(60, Math.round(temp * 10)));
        bins[binIndex]++;
      }
    }

    const values = [];
    bins.forEach((count, binIndex) => {
      if (count) values.push(binIndex / 10);
    });
    if (values.length <= 1) return values;
    const count = Math.min(7, values.length);

    let centers = Array.from({ length: count }, (_, i) =>
      values[Math.round(i * (values.length - 1) / (count - 1))]);

    for (let iteration = 0; iteration < 100; iteration++) {
      const sums = new Array(centers.length).fill(0);
      const weights = new Array(centers.length).fill(0);
      values.forEach(value => {
        const binIndex = Math.round(value * 10);
        const group = nearestCenter(value, centers);
        sums[group] += value * bins[binIndex];
        weights[group] += bins[binIndex];
      });
      const next = centers.map((_, i) => weights[i] ? sums[i] / weights[i] : null)
        .filter(value => value !== null).sort((a, b) => a - b);
      const converged = next.length === centers.length &&
        next.every((value, i) => Math.abs(value - centers[i]) < 0.0001);
      centers = next;
      if (converged) break;
    }
    return centers.map(c => Math.round(c * 100) / 100);
  }

  function pitchForTemperature(temp, mode = 'fixed', centers = [], instrument = 'bass') {
    const notes = getNotes(instrument);
    const value = Math.max(0, Math.min(6, temp));
    if ((mode === 'learned' || mode === 'learn') && centers.length) {
      const group = nearestCenter(value, centers);
      const index = centers.length === 1 ? 0 :
        Math.round(group * (notes.length - 1) / (centers.length - 1));
      return notes[index];
    }
    // Fixed scale: Coldest (0) to Hottest (6) -> Do to Si
    const index = Math.max(0, Math.min(notes.length - 1, Math.round(value)));
    return notes[index];
  }

  function pitchForSpot(spot, mode = 'fixed', centers = [], testPattern = false, instrument = 'bass') {
    if (spot.rest) return null;
    const note = pitchForTemperature(spot.temperature, mode, centers, instrument);
    const highDo = getHighDo(instrument);
    return testPattern && spot.index === 7 && note.name === 'Do' ? highDo : note;
  }

  function colorForTemperature(temp) {
    const c = colorRGBForTemperature(temp);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  root.DJEarthTemperature = Object.freeze({
    BASS_NOTES: DEEP_BASS_NOTES,
    DEEP_BASS_NOTES,
    TENOR_BASS_NOTES,
    PIANO_NOTES,
    HIGH_DO_BASS: HIGH_DO_DEEP_BASS,
    HIGH_DO_DEEP_BASS,
    HIGH_DO_TENOR_BASS,
    HIGH_DO_PIANO,
    THERMAL_KEYS,
    TEST_TEMPS,
    TEST_COLORS,
    temperatureFromRGB,
    temperatureLabel,
    createTestPattern,
    createEarthThermalMap,
    scanSpots,
    learnTemperatureGroups,
    pitchForTemperature,
    pitchForSpot,
    nearestCenter,
    colorForTemperature,
    colorRGBForTemperature,
    isRestPixel
  });
})(globalThis);
