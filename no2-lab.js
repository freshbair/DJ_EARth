(function (global) {
  'use strict';
  const panel = document.querySelector('#no2Lab');
  const $ = id => document.getElementById(id);
  const canvas = $('no2Canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  const engine = global.DJEarthNO2;
  const voice = global.DJEarthInstruments.createInstrument('flute', { volume: 0.55 });
  let image = null, sourceName = '', request = 0, ticket = 0, timer;
  const message = text => { $('no2Status').textContent = text; };
  function stop() { ticket++; clearTimeout(timer); voice.stopAll(); }
  function position() { return [Number($('no2X').value) / 100 * (canvas.width - 1), Number($('no2Y').value) / 100 * (canvas.height - 1)]; }
  function read() {
    if (!image) return null;
    const [x, y] = position();
    return engine.sample(image, x, y);
  }
  function describe() {
    const value = read();
    return `${sourceName}. Column ${$('no2X').value} percent, row ${$('no2Y').value} percent. ` +
      (value === null ? 'Unreadable here. No note: background, overlay or colour outside the accepted palette.' : `Approximate NO₂ column ${value.toFixed(1)} times 10 to the power 15 molecules per square centimetre. Higher pitch means more NO₂, not a health-risk category.`);
  }
  function redraw() {
    if (!image) return;
    ctx.putImageData(image, 0, 0);
    const [x, y] = position();
    ctx.beginPath(); ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = '#082033'; ctx.lineWidth = 2; ctx.stroke();
    $('no2XValue').textContent = $('no2X').value + '%';
    $('no2YValue').textContent = $('no2Y').value + '%';
    $('no2Reading').textContent = describe();
  }
  function controls(enabled) {
    panel.querySelectorAll('[data-no2-ready]').forEach(el => { el.disabled = !enabled; });
  }
  async function load(url, name, uploaded = false) {
    const current = ++request;
    stop(); image = null; controls(false);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    $('no2Reading').textContent = 'No map reading available.';
    message('Loading map…');
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (current !== request) return;
      if (img.naturalWidth * img.naturalHeight > 24000000) throw Error('Choose an image smaller than 24 megapixels.');
      canvas.width = 1200; canvas.height = 675;
      if (Math.abs(img.naturalWidth / img.naturalHeight - 1200 / 675) > 0.005) throw Error('This experiment needs the same 16:9 NASA NO₂ map layout with its legend.');
      ctx.drawImage(img, 0, 0, 1200, 675);
      const candidate = ctx.getImageData(0, 0, 1200, 675);
      if (!engine.compatible(candidate)) throw Error('The colour legend does not match. Use the supplied NO₂ template; temperature and other palettes need their own calibration.');
      image = candidate; sourceName = name;
      controls(true); redraw();
      message(uploaded ? 'Local map loaded. Palette check passed; this does not verify its units, date or scientific accuracy. Confirm it uses the same NO₂ scale and layout.' : `${name} loaded. Historical map, not today’s conditions.`);
    } catch (error) {
      if (current === request) { image = null; ctx.clearRect(0, 0, canvas.width, canvas.height); message(error.message); }
    }
  }
  async function play(reference = false) {
    stop(); if (!image) return;
    global.djEarthApp?.stop(); global.djEarthSolo?.stop();
    const current = ticket;
    try {
      await voice.ready();
      if (current !== ticket) return;
      const values = reference ? [0, 2.5, 5, 7.5, 10] : [read()];
      let index = 0;
      function step() {
        if (current !== ticket) return;
        const value = values[index++];
        voice.setVolume(Number($('volume').value) / 100);
        if (value !== null) voice.play(engine.frequency(value));
        message(reference ? `Sound reference: ${value} on the 0–10 NO₂ scale. Loudness stays fixed; pitch carries the value.` : describe());
        if (index < values.length) timer = setTimeout(step, 1100);
      }
      step();
    } catch (error) { if (current === ticket) message(`Audio unavailable: ${error.message}`); }
  }
  panel.querySelectorAll('input[name=no2Source]').forEach(radio => radio.addEventListener('change', () => {
    $('no2Upload').value = '';
    void load(`assets/no2/march-${radio.value}.jpg`, radio.value === '2020' ? 'March 2020' : 'March 2015–2019 average');
  }));
  $('no2Upload').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 20 * 1024 * 1024) { message('Choose a PNG or JPEG smaller than 20 MB. The previous map remains selected.'); return; }
    panel.querySelectorAll('input[name=no2Source]').forEach(r => { r.checked = false; });
    const url = URL.createObjectURL(file);
    try { await load(url, `Uploaded map: ${file.name}`, true); } finally { URL.revokeObjectURL(url); }
  });
  ['no2X', 'no2Y'].forEach(id => $(id).addEventListener('input', () => { stop(); redraw(); }));
  canvas.addEventListener('click', event => {
    if (!image) return;
    stop(); const rect = canvas.getBoundingClientRect();
    $('no2X').value = Math.round(100 * (event.clientX - rect.left) / rect.width);
    $('no2Y').value = Math.round(100 * (event.clientY - rect.top) / rect.height);
    redraw(); void play();
  });
  $('no2Play').addEventListener('click', () => { void play(); });
  $('no2Reference').addEventListener('click', () => { void play(true); });
  $('no2Stop').addEventListener('click', () => { stop(); message('NO₂ sound stopped.'); });
  $('volume').addEventListener('input', () => voice.setVolume(Number($('volume').value) / 100));
  ['soloNote', 'soloSingle', 'soloPhrase', 'playScan'].forEach(id => $(id).addEventListener('click', stop));
  function visibility() { panel.hidden = document.body.dataset.track !== '2'; if (panel.hidden) stop(); }
  new MutationObserver(visibility).observe(document.body, { attributes: true, attributeFilter: ['data-track'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  global.addEventListener('pagehide', stop);
  $('no2Evaluation').textContent = `Training: ${DJEarthNO2Model.report.training_samples} labelled colours from the 2015–2019 legend. Test: ${DJEarthNO2Model.report.held_out_legend_samples} colours from the 2020 legend, never used for fitting. Average absolute legend error: ${DJEarthNO2Model.report.mae.toFixed(3)} on the 0–10 scale. This is NOT measured map-pixel accuracy.`;
  visibility(); void load('assets/no2/march-2020.jpg', 'March 2020');
})(globalThis);
