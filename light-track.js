/* Pure image-to-note logic for the light → piano layer.
   No canvas, audio, or DOM state lives here, so future layers can stay separate. */
(function (root) {
  'use strict';

  const names = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
  const pitches = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];
  const midi = [60, 62, 64, 65, 67, 69, 71];
  const NOTES = Object.freeze(names.map((name, index) => Object.freeze({
    name, pitch: pitches[index], hz: 440 * 2 ** ((midi[index] - 69) / 12)
  })));
  const HIGH_DO = Object.freeze({ name: 'Do', pitch: 'C5', hz: NOTES[0].hz * 2 });
  const TEST_VALUES = Object.freeze([0, 48, 88, 128, 168, 208, 255, 0]);

  function brightnessFromRGB(r, g, b) {
    return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  }

  function validateImage(image) {
    if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
        image.width < 1 || image.height < 1 || !image.data ||
        image.data.length < image.width * image.height * 4) {
      throw new TypeError('Expected a nonempty RGBA image grid.');
    }
  }

  function createTestPattern() {
    const width = 800;
    const height = 160;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const value = TEST_VALUES[Math.floor(x / 100)];
        data[offset] = value;
        data[offset + 1] = value;
        data[offset + 2] = value;
        data[offset + 3] = 255;
      }
    }
    return { width, height, data };
  }

  function scanSpots(image) {
    validateImage(image);
    const y = Math.floor(image.height / 2);
    return Array.from({ length: 8 }, (_, index) => {
      const x = Math.min(image.width - 1, Math.floor((index + 0.5) * image.width / 8));
      const offset = (y * image.width + x) * 4;
      const rest = image.data[offset + 3] === 0;
      return {
        index, x, y, rest,
        brightness: rest ? null : brightnessFromRGB(
          image.data[offset], image.data[offset + 1], image.data[offset + 2])
      };
    });
  }

  function nearestCenter(value, centers) {
    let best = 0;
    let distance = Infinity;
    centers.forEach((center, index) => {
      const candidate = Math.abs(value - center);
      // A tie stays with the darker (earlier) group.
      if (candidate < distance) {
        best = index;
        distance = candidate;
      }
    });
    return best;
  }

  function learnBrightnessGroups(image, maxSamples = 32768) {
    validateImage(image);
    const pixels = image.width * image.height;
    const requested = Number.isFinite(maxSamples) ? Math.floor(maxSamples) : 32768;
    const sampleCount = Math.min(pixels, Math.max(1, requested));
    const histogram = new Uint32Array(256);

    // Use a 2D sampling grid matched to the image aspect ratio. A stride over
    // flattened pixels can alias repeated columns and miss entire brightness bands.
    const rows = Math.min(image.height, sampleCount,
      Math.max(1, Math.round(Math.sqrt(sampleCount * image.height / image.width))));
    const columns = Math.min(image.width, Math.max(1, Math.floor(sampleCount / rows)));
    for (let row = 0; row < rows; row++) {
      const y = Math.floor((row + 0.5) * image.height / rows);
      for (let column = 0; column < columns; column++) {
        const x = Math.floor((column + 0.5) * image.width / columns);
        const offset = (y * image.width + x) * 4;
        if (image.data[offset + 3] === 0) continue;
        histogram[brightnessFromRGB(image.data[offset], image.data[offset + 1], image.data[offset + 2])]++;
      }
    }

    const values = [];
    histogram.forEach((count, value) => { if (count) values.push(value); });
    if (values.length <= 1) return values;
    const count = Math.min(7, values.length);

    // Spread initial centers across distinct observed values, avoiding duplicate
    // seeds even when black dominates a night-lights image. No random seed needed.
    let centers = Array.from({ length: count }, (_, i) =>
      values[Math.round(i * (values.length - 1) / (count - 1))]);

    for (let iteration = 0; iteration < 100; iteration++) {
      const sums = new Array(centers.length).fill(0);
      const weights = new Array(centers.length).fill(0);
      values.forEach(value => {
        const group = nearestCenter(value, centers);
        sums[group] += value * histogram[value];
        weights[group] += histogram[value];
      });
      // Empty groups are removed rather than retaining a phantom learned center.
      const next = centers.map((_, i) => weights[i] ? sums[i] / weights[i] : null)
        .filter(value => value !== null).sort((a, b) => a - b);
      const converged = next.length === centers.length &&
        next.every((value, i) => Math.abs(value - centers[i]) < 0.0001);
      centers = next;
      if (converged) break;
    }
    return centers;
  }

  function pitchForBrightness(brightness, mode = 'fixed', centers = []) {
    const value = Math.max(0, Math.min(255, brightness));
    if ((mode === 'learned' || mode === 'learn') && centers.length) {
      const group = nearestCenter(value, centers);
      // A uniform image consistently uses Do. With multiple groups, spread them
      // across the full Do–Si scale while preserving dark-to-bright order.
      const index = centers.length === 1 ? 0 :
        Math.round(group * (NOTES.length - 1) / (centers.length - 1));
      return NOTES[index];
    }
    return NOTES[Math.floor(value * NOTES.length / 256)];
  }

  function pitchForSpot(spot, mode = 'fixed', centers = [], testPattern = false) {
    if (spot.rest) return null;
    const note = pitchForBrightness(spot.brightness, mode, centers);
    // Only the built-in demonstration phrase closes on the next octave.
    // Uploaded images retain the same brightness-only mapping at every spot.
    return testPattern && spot.index === 7 && note.pitch === 'C4' ? HIGH_DO : note;
  }

  root.DJEarthLight = Object.freeze({
    NOTES, TEST_VALUES, brightnessFromRGB, createTestPattern, scanSpots,
    learnBrightnessGroups, pitchForBrightness, pitchForSpot, nearestCenter
  });
})(globalThis);
