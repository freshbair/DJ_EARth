/* App controller. Light analysis and piano synthesis live in separate files so
   temperature → bass and lightning → guitar can later be separate tracks. */
(function (global) {
  'use strict';
  const light = global.DJEarthLight;
  const piano = global.createDJEarthPiano({ volume: 0.55 });
  const $ = selector => document.querySelector(selector);
  const canvas = $('#sourceCanvas');
  const context = canvas.getContext('2d');
  const overlay = $('#spotOverlay');
  const route = $('#scanRoute');
  const playButton = $('#playScan');
  const stopButton = $('#stopScan');
  const upload = $('#imageUpload');
  const volume = $('#volume');
  const status = $('#status');
  const modes = document.querySelectorAll('input[name="pitchMode"]');
  const STEP_MS = 500;
  const RELEASE_MS = Math.ceil(piano.tailSeconds * 1000) + 30;
  let image;
  let imageName = 'Test pattern';
  let spots = [];
  let centers = [];
  let mode = 'fixed';
  let isTestPattern = true;
  let run = 0;
  let timer;
  let activeIndex = -1;
  let scanning = false;
  let imageRequest = 0;
  let loading = false;

  function noteAt(spot) {
    return light.pitchForSpot(spot, mode, centers, isTestPattern);
  }

  function highlight(index) {
    activeIndex = index;
    [overlay, route].forEach(parent => {
      Array.from(parent.children).forEach((button, i) => {
        button.classList.toggle('active', i === index);
        if (i === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    });
  }

  function showSpot(index) {
    const spot = spots[index];
    const note = noteAt(spot);
    highlight(index);
    $('#activeBrightness').textContent = spot.rest ? '—' : String(spot.brightness);
    $('#activeNote').textContent = note ? `${note.name} · ${note.pitch} · ${note.hz.toFixed(1)} Hz` : 'Rest';
    $('#scanPosition').textContent = `${index + 1} / 8`;
    status.textContent = `Spot ${index + 1}: ${spot.rest ? 'fully transparent — rest' : `brightness ${spot.brightness}, ${note.name} (${note.pitch})`}.`;
    return note;
  }

  function stopPlayback(message = 'Stopped. Press Play scan to restart at spot 1.') {
    run++;
    clearTimeout(timer);
    piano.stopAll();
    scanning = false;
    highlight(-1);
    stopButton.disabled = true;
    status.textContent = message;
  }

  async function playScan() {
    stopPlayback('Starting scan…');
    if (loading) return;
    const ticket = run;
    scanning = true;
    stopButton.disabled = false;
    try {
      await piano.ready();
      if (ticket !== run) return;
      let index = 0;
      function step() {
        if (ticket !== run) return;
        try {
          const note = showSpot(index);
          if (note) piano.play(note.hz);
          index++;
          if (index < spots.length) timer = setTimeout(step, STEP_MS);
          else timer = setTimeout(() => {
            if (ticket === run) stopPlayback('Scan complete. Play again to restart at spot 1.');
          }, RELEASE_MS);
        } catch (error) {
          stopPlayback(`Playback stopped: ${error.message}`);
        }
      }
      step();
    } catch (error) {
      if (ticket === run) stopPlayback(`Audio could not start: ${error.message}`);
    }
  }

  async function previewSpot(index) {
    stopPlayback();
    if (loading) return;
    const ticket = run;
    const note = showSpot(index);
    stopButton.disabled = false;
    try {
      if (note) {
        await piano.ready();
        if (ticket !== run) return;
        piano.play(note.hz);
      }
      if (ticket !== run) return;
      timer = setTimeout(() => {
        if (ticket === run) stopPlayback('Preview complete. Press Play scan for all eight spots.');
      }, RELEASE_MS);
    } catch (error) {
      if (ticket === run) stopPlayback(`Audio could not start: ${error.message}`);
    }
  }

  function renderRoute() {
    overlay.replaceChildren();
    route.replaceChildren();
    spots.forEach((spot, index) => {
      const note = noteAt(spot);
      const label = `Preview spot ${index + 1}: ${spot.rest ? 'transparent, rest' : `brightness ${spot.brightness}, ${note.name}, ${note.pitch}`}`;
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'spot';
      marker.style.left = `${(spot.x + 0.5) / image.width * 100}%`;
      marker.style.top = `${(spot.y + 0.5) / image.height * 100}%`;
      marker.textContent = String(index + 1);
      marker.setAttribute('aria-label', label);
      marker.addEventListener('click', () => { void previewSpot(index); });
      overlay.append(marker);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'route-step';
      button.setAttribute('aria-label', label);
      const noteLabel = note ? (note.name === 'Do' && note.pitch === 'C5' ? 'High Do' : note.name) : 'Rest';
      button.innerHTML = `<span class="step-number">SPOT ${index + 1}</span><strong class="note-name">${noteLabel}</strong>${note ? `<small class="brightness-value">${note.pitch} · ${note.hz.toFixed(1)} Hz</small>` : ''}<small class="brightness-value">${spot.rest ? 'Transparent' : `${spot.brightness} / 255`}</small>`;
      button.addEventListener('click', () => { void previewSpot(index); });
      route.append(button);
    });
  }

  function renderLearning() {
    const list = $('#groupCenters');
    list.replaceChildren();
    $('#learningSummary').textContent = centers.length
      ? `${centers.length} ${centers.length === 1 ? 'group' : 'groups'} learned from the current image. Center values are brightness on a 0–255 scale, sorted dark to bright.`
      : 'No non-transparent pixels in the training sample. Transparent spots are rests; any other spots use the fixed scale.';
    centers.forEach(center => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      const value = Math.round(center);
      swatch.className = 'swatch';
      swatch.style.backgroundColor = `rgb(${value}, ${value}, ${value})`;
      swatch.setAttribute('aria-hidden', 'true');
      const text = document.createElement('strong');
      text.textContent = center.toFixed(1);
      const label = document.createElement('small');
      const note = light.pitchForBrightness(center, 'learned', centers);
      label.textContent = `${note.name} · ${note.pitch}`;
      item.append(swatch, text, label);
      list.append(item);
    });
  }

  function applyImage(nextImage, name, testPattern = false) {
    // Analyze a separate RGBA grid. Markers and the scan line are DOM overlays;
    // neither is ever drawn into the pixels used by the model or scan.
    const nextSpots = light.scanSpots(nextImage);
    const nextCenters = light.learnBrightnessGroups(nextImage);
    stopPlayback();
    image = nextImage;
    imageName = name;
    isTestPattern = testPattern;
    spots = nextSpots;
    centers = nextCenters;
    canvas.width = image.width;
    canvas.height = image.height;
    const display = context.createImageData(image.width, image.height);
    display.data.set(image.data);
    context.putImageData(display, 0, 0);
    $('#sourceTitle').textContent = name;
    $('#sourceMeta').textContent = `${image.width} × ${image.height} pixels · 8 spots · 0.5 seconds per spot`;
    canvas.setAttribute('aria-label', `${name}. Eight sampling spots from left to right along the middle row.`);
    renderRoute();
    renderLearning();
    $('#activeBrightness').textContent = '—';
    $('#activeNote').textContent = '—';
    $('#scanPosition').textContent = '— / 8';
    const result = $('#testResult');
    result.hidden = !isTestPattern;
    $('#patternNote').hidden = !isTestPattern;
    if (isTestPattern) {
      const notes = spots.map(spot => light.pitchForSpot(spot, 'fixed', [], true));
      const passed = notes.map(note => note.pitch).join(',') === 'C4,D4,E4,F4,G4,A4,B4,C5';
      const actual = notes.map(note => `${note.name} (${note.pitch})`).join(' → ');
      result.textContent = `${passed ? 'Test phrase check passed' : 'Test phrase check failed'}: ${actual}`;
    }
    status.textContent = `${name} ready. ${mode === 'fixed' ? 'Fixed scale' : 'Learn from image'} mode. Press Play scan.`;
  }

  function setMode(value) {
    if (value !== 'fixed' && value !== 'learned') return;
    stopPlayback();
    mode = value;
    modes.forEach(input => { input.checked = input.value === mode; });
    renderRoute();
    $('#activeBrightness').textContent = '—';
    $('#activeNote').textContent = '—';
    $('#scanPosition').textContent = '— / 8';
    status.textContent = `${mode === 'fixed' ? 'Fixed scale' : 'Learn from image'} mode selected. Press Play scan to restart at spot 1.`;
  }

  function useTestPattern() {
    imageRequest++;
    loading = false;
    playButton.disabled = false;
    upload.value = '';
    applyImage(light.createTestPattern(), 'Test pattern', true);
  }

  async function uploadImage(file) {
    if (!file) return;
    const request = ++imageRequest;
    stopPlayback('Opening image…');
    loading = true;
    playButton.disabled = true;
    let url;
    try {
      if (!/^image\/(png|jpeg)$/.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
        throw new Error('Choose a PNG or JPG file.');
      }
      url = URL.createObjectURL(file);
      const decoded = new Image();
      await new Promise((resolve, reject) => {
        decoded.onload = resolve;
        decoded.onerror = () => reject(new Error('The image could not be decoded.'));
        decoded.src = url;
      });
      if (request !== imageRequest) return;
      // Decode into a temporary canvas so a failed upload cannot corrupt the
      // existing image. Keep original resolution; sample the same displayed RGB.
      const staging = document.createElement('canvas');
      staging.width = decoded.naturalWidth;
      staging.height = decoded.naturalHeight;
      const stagingContext = staging.getContext('2d', { willReadFrequently: true });
      stagingContext.drawImage(decoded, 0, 0);
      const pixels = stagingContext.getImageData(0, 0, staging.width, staging.height);
      applyImage(pixels, file.name);
    } catch (error) {
      if (request === imageRequest) status.textContent = `Could not open image: ${error.message} The previous image is still available.`;
    } finally {
      if (url) URL.revokeObjectURL(url);
      if (request === imageRequest) {
        loading = false;
        playButton.disabled = false;
      }
    }
  }

  playButton.addEventListener('click', () => { void playScan(); });
  stopButton.addEventListener('click', () => stopPlayback());
  $('#resetPattern').addEventListener('click', useTestPattern);
  volume.addEventListener('input', () => {
    const value = Number(volume.value);
    $('#volumeValue').textContent = `${value}%${value === 0 ? ' · silent' : ''}`;
    piano.setVolume(value / 100);
  });
  modes.forEach(input => input.addEventListener('change', () => {
    if (input.checked) setMode(input.value);
  }));
  upload.addEventListener('change', () => { void uploadImage(upload.files[0]); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback('Scan stopped while the page was hidden.'); });
  global.addEventListener('pagehide', () => stopPlayback());

  // Small controller API also supports reproducible local integration checks.
  global.djEarthApp = Object.freeze({
    playScan, previewSpot, stop: stopPlayback, setMode, uploadImage,
    loadImageData(nextImage, name = 'Local image') {
      imageRequest++;
      loading = false;
      playButton.disabled = false;
      applyImage(nextImage, name);
    },
    useTestPattern,
    getState: () => ({ imageName, width: image.width, height: image.height, mode,
      spots: spots.map(spot => ({ ...spot })), centers: centers.slice(),
      noteNames: spots.map(spot => noteAt(spot)?.name || 'Rest'),
      activeIndex, scanning, loading, volume: Number(volume.value) / 100 })
  });
  useTestPattern();
})(globalThis);
