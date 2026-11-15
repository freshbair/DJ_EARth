/* Fixed, supervised colour-to-column model. No retraining on uploaded maps. */
(function (global) {
  'use strict';
  function predict(rgb) {
    if (!rgb || rgb.length < 3 || !rgb.slice(0, 3).every(Number.isFinite)) return null;
    const hi = Math.max(...rgb), lo = Math.min(...rgb);
    // Dark ink and near-neutral pixels are ambiguous with the upper legend endpoint.
    if (hi < 30 || (hi - lo) / hi < 0.12) return null;
    const model = global.DJEarthNO2Model;
    const neighbors = model.samples.map((s, index) => ({
      distance: Math.hypot(rgb[0] - s[0], rgb[1] - s[1], rgb[2] - s[2]), value: s[3], index
    })).sort((a, b) => a.distance - b.distance || a.index - b.index);
    if (neighbors[0].distance > model.maxDistance) return null;
    return neighbors.slice(0, model.k).reduce((sum, n) => sum + n.value, 0) / model.k;
  }
  function sample(image, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
    const nx = x / image.width, ny = y / image.height;
    // This prototype accepts only the supplied NASA northeast-US template.
    if (ny < 0.18 || (nx > 0.62 && ny > 0.79)) return null;
    const values = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const px = Math.floor(x) + dx, py = Math.floor(y) + dy;
      if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
      const i = (py * image.width + px) * 4;
      const rgb = Array.from(image.data.slice(i, i + 3));
      if (image.data[i + 3] < 250 || Math.hypot(rgb[0] - 87, rgb[1] - 104, rgb[2] - 126) < 24) continue;
      const value = predict(rgb);
      if (value !== null) values.push(value);
    }
    if (values.length < 15) return null;
    values.sort((a, b) => a - b);
    if (values[values.length - 1] - values[0] > 1.5) return null;
    return values[Math.floor(values.length / 2)];
  }
  function compatible(image) {
    if (Math.abs(image.width / image.height - 1200 / 675) > 0.005) return false;
    // Test known legend locations against the training palette, not map predictions.
    let error = 0;
    for (const x of [820, 850, 920, 970, 1020, 1070]) {
      const px = Math.min(image.width - 1, Math.floor(x / 1200 * image.width));
      const py = Math.min(image.height - 1, Math.floor(583 / 675 * image.height));
      const i = (py * image.width + px) * 4;
      if (image.data[i + 3] < 250) return false;
      const value = predict(Array.from(image.data.slice(i, i + 3)));
      if (value === null) return false;
      error += Math.abs(value - (x - 797) * 10 / 316);
    }
    return error / 6 < 0.3;
  }
  // A fixed continuous two-octave scale preserves differences between map dates.
  function frequency(value) {
    if (!Number.isFinite(value) || value < 0 || value > 10) throw new RangeError('NO2 must be between 0 and 10.');
    return 523.2511306 * 2 ** (value / 5);
  }
  global.DJEarthNO2 = Object.freeze({ predict, sample, compatible, frequency });
})(globalThis);
