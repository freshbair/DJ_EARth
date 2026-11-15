/* DJ_EARth App Controller
   Supports both planetary tracks:
   Track 1: Night lights (Brightness → piano)
   Track 2: Earth Temperature (Temperature variation → harmonica)
*/
(function (global) {
  'use strict';
  const light = global.DJEarthLight;
  const tempTrack = global.DJEarthTemperature;
  const piano = global.createDJEarthPiano({ volume: 0.55 });
  const bass = global.DJEarthInstruments.createInstrument('harmonica', { volume: 0.55 });

  const $ = selector => document.querySelector(selector);
  const canvas = $('#sourceCanvas');
  const context = canvas.getContext('2d');
  const playButton = $('#playScan');
  const stopButton = $('#stopScan');
  const upload = $('#imageUpload');
  const uploadLabel = $('#uploadLabel');
  const volume = $('#volume');
  const status = $('#status');
  const resetPatternBtn = $('#resetPattern');
  const useEarthMapBtn = $('#useEarthMap');
  const trackTempBtn = $('#trackTempBtn');
  const trackLightBtn = $('#trackLightBtn');
  const instrumentFieldset = $('#instrumentFieldset');
  const pitchModes = document.querySelectorAll('input[name="pitchMode"]');
  const registerModes = document.querySelectorAll('input[name="bassRegister"]');

  const STEP_MS = 500;
  const RELEASE_MS = 1100;

  // Preset 8 geographic spots across the Earth globe for earth-temperature.jpg
  const EARTH_PRESET_SPOTS = [
    { x: 95, y: 242, label: 'West Pacific' },
    { x: 210, y: 242, label: 'East Pacific' },
    { x: 325, y: 242, label: 'South America' },
    { x: 440, y: 242, label: 'Atlantic' },
    { x: 555, y: 242, label: 'Central Africa' },
    { x: 670, y: 242, label: 'Indian Ocean' },
    { x: 785, y: 242, label: 'Southeast Asia' },
    { x: 880, y: 242, label: 'Western Pacific' }
  ];

  let currentTrack = 'temperature'; // 'temperature' | 'light'
  let bassRegister = 'deep';        // 'deep' (C2–C3) | 'tenor' (C3–C4)
  let image;
  let imageName = 'Earth thermal map';
  let spots = [];
  let centers = [];
  let mode = 'learned'; // Images automatically learn their note groups.
  let isTestPattern = false;
  let isEarthPreset = true;
  let run = 0;
  let timer;
  let activeIndex = -1;
  let scanning = false;
  let imageRequest = 0;
  let loading = false;

  function activeVoice() {
    return currentTrack === 'temperature' ? bass : piano;
  }

  function noteAt(spot) {
    if (currentTrack === 'temperature') {
      const inst = 'piano';
      return tempTrack.pitchForSpot(spot, mode, centers, isTestPattern, inst);
    }
    return light.pitchForSpot(spot, mode, centers, isTestPattern);
  }

  function highlight(index) {
    activeIndex = index;
  }

  function showSpot(index) {
    const spot = spots[index];
    const note = noteAt(spot);
    highlight(index);
    syncMapIntensity(spot.rest ? null : (currentTrack === 'temperature' ? spot.temperature / 6 : spot.brightness / 255), note);

    if (currentTrack === 'temperature') {
      const tempStr = spot.rest ? '—' : `${spot.temperature.toFixed(1)} · ${tempTrack.temperatureLabel(spot.temperature)}`;
      $('#activeBrightness').textContent = tempStr;
      $('#activeNote').textContent = note ? `${note.name} · ${note.pitch} · ${note.hz.toFixed(1)} Hz` : 'Rest';
      $('#scanPosition').textContent = `${index + 1} / 8`;
      const loc = spot.label ? ` (${spot.label})` : '';
      status.textContent = `Spot ${index + 1}${loc}: ${spot.rest ? 'off-globe background — rest' : `temp ${spot.temperature.toFixed(1)} / 6 (${tempTrack.temperatureLabel(spot.temperature)}), harmonica: ${note.name} (${note.pitch} · ${note.hz.toFixed(1)} Hz)`}.`;
    } else {
      $('#activeBrightness').textContent = spot.rest ? '—' : String(spot.brightness);
      $('#activeNote').textContent = note ? `${note.name} · ${note.pitch} · ${note.hz.toFixed(1)} Hz` : 'Rest';
      $('#scanPosition').textContent = `${index + 1} / 8`;
      status.textContent = `Spot ${index + 1}: ${spot.rest ? 'fully transparent — rest' : `brightness ${spot.brightness}, piano: ${note.name} (${note.pitch})`}.`;
    }
    return note;
  }

  function stopPlayback(message = 'Stopped. Click a map point to listen.') {
    run++;
    clearTimeout(timer);
    piano.stopAll();
    bass.stopAll();
    scanning = false;
    document.body.classList.remove('is-playing');
    highlight(-1);
    stopButton.disabled = true;
    status.textContent = message;
  }

  async function playScan() {
    global.djEarthSolo?.stop();
    stopPlayback('Starting scan…');
    if (loading) return;
    const ticket = run;
    scanning = true;
    stopButton.disabled = false;
    const voice = activeVoice();
    try {
      await voice.ready();
      if (ticket !== run) return;
      document.body.classList.add('is-playing');
      let index = 0;
      function step() {
        if (ticket !== run) return;
        try {
          const note = showSpot(index);
          if (note) voice.play(note.hz);
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
    global.djEarthSolo?.stop();
    stopPlayback();
    if (loading) return;
    const ticket = run;
    const note = showSpot(index);
    stopButton.disabled = false;
    const voice = activeVoice();
    try {
      if (note) {
        await voice.ready();
        if (ticket !== run) return;
        voice.play(note.hz);
      }
      if (ticket !== run) return;
      timer = setTimeout(() => {
        if (ticket === run) stopPlayback('Preview complete. Press Play scan for all eight spots.');
      }, RELEASE_MS);
    } catch (error) {
      if (ticket === run) stopPlayback(`Audio could not start: ${error.message}`);
    }
  }

  function syncMapIntensity(fraction, note) {
    const intensity = fraction === null ? 0 : Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    return global.djEarthSolo?.applyMapPoint(intensity, note?.hz ?? null);
  }

  async function previewCoordinates(x, y) {
    if (!image || loading) return;
    stopPlayback();
    const ticket = run;
    const voice = activeVoice();
    const clampedX = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
    const clampedY = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
    const offset = (clampedY * image.width + clampedX) * 4;
    const r = image.data[offset];
    const g = image.data[offset + 1];
    const b = image.data[offset + 2];
    const a = image.data[offset + 3];
    const patternIndex = Math.floor(clampedX * 8 / image.width);

    let note, fraction;
    if (currentTrack === 'temperature') {
      const rest = tempTrack.isRestPixel(r, g, b, a);
      const temp = rest ? null : tempTrack.temperatureFromRGB(r, g, b);
      fraction = rest ? null : temp / 6;
      const inst = 'piano';
      note = tempTrack.pitchForSpot({ rest, temperature: temp, index: patternIndex }, mode, centers, isTestPattern, inst);
      $('#activeBrightness').textContent = rest ? '—' : `${temp.toFixed(1)} · ${tempTrack.temperatureLabel(temp)}`;
      $('#activeNote').textContent = note ? `${note.name} · ${note.pitch} · ${note.hz.toFixed(1)} Hz` : 'Rest';
      $('#scanPosition').textContent = `Map (${clampedX}, ${clampedY})`;
      status.textContent = rest ? 'Clicked off-globe background — rest.' : `Clicked (${clampedX}, ${clampedY}): temp ${temp.toFixed(1)} / 6 (${tempTrack.temperatureLabel(temp)}), harmonica: ${note.name} (${note.pitch} · ${note.hz.toFixed(1)} Hz).`;
    } else {
      const rest = a === 0;
      const br = rest ? null : light.brightnessFromRGB(r, g, b);
      fraction = rest ? null : br / 255;
      note = light.pitchForSpot({ rest, brightness: br, index: patternIndex }, mode, centers, isTestPattern);
      $('#activeBrightness').textContent = rest ? '—' : String(br);
      $('#activeNote').textContent = note ? `${note.name} · ${note.pitch} · ${note.hz.toFixed(1)} Hz` : 'Rest';
      $('#scanPosition').textContent = `Image (${clampedX}, ${clampedY})`;
      status.textContent = rest ? 'Clicked transparent pixel — rest.' : `Clicked (${clampedX}, ${clampedY}): brightness ${br}, piano: ${note.name} (${note.pitch}).`;
    }

    const live = syncMapIntensity(fraction, note);
    if (live) return;
    try {
      if (note) {
        await voice.ready();
        if (ticket !== run) return;
        voice.play(note.hz);
      }
    } catch { /* Silent if audio not ready */ }
  }

  function renderLearning() {
    const list = $('#groupCenters');
    list.replaceChildren();

    if (currentTrack === 'temperature') {
      $('#learningTitle').textContent = 'Image analysis';
      $('#learningSummary').textContent = centers.length
        ? `${centers.length} ${centers.length === 1 ? 'group' : 'groups'} learned from the current map. Center values are temperatures on a 0–6 scale, sorted coldest to hottest.`
        : 'No valid temperature pixels found in the training sample.';
      $('#learningHelper').textContent = 'One-dimensional k-means learns up to seven temperature groups from this map, ordered from freezing to scorching across Do–Si. In “Learn from image” mode, harmonica pitches align to these learned centers.';

      const inst = 'piano';
      centers.forEach(center => {
        const item = document.createElement('li');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.backgroundColor = tempTrack.colorForTemperature(center);
        swatch.setAttribute('aria-hidden', 'true');
        const text = document.createElement('strong');
        text.textContent = center.toFixed(1);
        const label = document.createElement('small');
        const note = tempTrack.pitchForTemperature(center, 'learned', centers, inst);
        label.textContent = `${note.name} · ${note.pitch}`;
        item.append(swatch, text, label);
        list.append(item);
      });
    } else {
      $('#learningTitle').textContent = 'Image analysis';
      $('#learningSummary').textContent = centers.length
        ? `${centers.length} ${centers.length === 1 ? 'group' : 'groups'} learned from the current image. Center values are brightness on a 0–255 scale, sorted dark to bright.`
        : 'No non-transparent pixels in the training sample. Transparent spots are rests; any other spots use the fixed scale.';
      $('#learningHelper').textContent = 'One-dimensional k-means learns up to seven brightness groups from a sample of this image. Groups run from dark to bright across Do–Si. A uniform image has one group: Do. These groups affect pitch only in “Learn from image” mode.';

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
  }

  function applyImage(nextImage, name, testPattern = false, isPreset = false) {
    let nextSpots;
    let nextCenters;

    if (currentTrack === 'temperature') {
      const customSpots = (isPreset && nextImage.width === 1024) ? EARTH_PRESET_SPOTS : null;
      nextSpots = tempTrack.scanSpots(nextImage, customSpots);
      nextCenters = tempTrack.learnTemperatureGroups(nextImage);
    } else {
      nextSpots = light.scanSpots(nextImage);
      nextCenters = light.learnBrightnessGroups(nextImage);
    }

    stopPlayback();
    image = nextImage;
    imageName = name;
    isTestPattern = testPattern;
    isEarthPreset = isPreset;
    spots = nextSpots;
    centers = nextCenters;

    canvas.width = image.width;
    canvas.height = image.height;
    const display = context.createImageData(image.width, image.height);
    display.data.set(image.data);
    context.putImageData(display, 0, 0);

    $('#sourceTitle').textContent = name;
    $('#sourceMeta').textContent = `${image.width} × ${image.height} pixels · click to listen`;
    canvas.setAttribute('aria-label', `${name}. Click any location to hear its mapped value, or use the column and row controls.`);

    renderLearning();

    $('#activeBrightness').textContent = '—';
    $('#activeNote').textContent = '—';
    $('#scanPosition').textContent = 'Choose a point';

    const result = $('#testResult');
    result.hidden = !isTestPattern;
    $('#patternNote').hidden = !isTestPattern;

    if (isTestPattern) {
      const notes = spots.map(spot => noteAt(spot));
      const expected = currentTrack === 'temperature'
        ? 'C4,D4,E4,F4,G4,A4,B4,C5'
        : 'C4,D4,E4,F4,G4,A4,B4,C5';
      const passed = notes.map(note => note.pitch).join(',') === expected;
      const actual = notes.map(note => `${note.name} (${note.pitch})`).join(' → ');
      result.textContent = `${passed ? 'Test phrase check passed' : 'Test phrase check failed'}: ${actual}`;
    }

    status.textContent = `${name} ready. ${mode === 'fixed' ? 'Fixed scale' : 'Learn from image'} mode. Click any map point to listen.`;
  }

  function setTrack(track) {
    if (track !== 'temperature' && track !== 'light') return;
    if (track === currentTrack) return;
    stopPlayback();
    imageRequest++;
    loading = false;
    playButton.disabled = false;
    currentTrack = track;
    // A different track uses a different sample format. Clear the previous
    // samples before its asynchronous image load or a pitch-mode change.
    image = undefined;
    spots = [];
    centers = [];
    renderLearning();

    if (currentTrack === 'temperature') {
      trackTempBtn.classList.add('active');
      trackTempBtn.setAttribute('aria-pressed', 'true');
      trackLightBtn.classList.remove('active');
      trackLightBtn.setAttribute('aria-pressed', 'false');

      $('#trackEyebrow').textContent = 'DJ_EARth / TRACK 2';
      $('#trackHeading').textContent = 'Hear the Earth’s temperature.';
      $('#trackIntro').textContent = 'Eight places, eight harmonica notes. Scan the thermal map from left to right and hear planetary temperature variation. The higher the temperature, the higher the pitch.';
      $('#trackTag').textContent = 'Temperature variation → harmonica · Higher temperature = higher pitch';
      $('#metricLabel').textContent = 'Temperature / 6';
      $('#instrumentLabel').textContent = 'harmonica note';
      uploadLabel.childNodes[0].textContent = 'Upload temperature map\n';
      useEarthMapBtn.hidden = false;
      instrumentFieldset.hidden = true;
      $('#footerScaleExplanation').textContent = 'Temperature track: Navy (0) → Blue (1) → Cyan (2) → Green (3) → Yellow (4) → Red (5) → Maroon (6) maps to harmonica notes Do, Ré, Mi, Fa, Sol, La, Si. The higher the temperature, the higher the pitch.';

      loadEarthPresetMap();
    } else {
      trackLightBtn.classList.add('active');
      trackLightBtn.setAttribute('aria-pressed', 'true');
      trackTempBtn.classList.remove('active');
      trackTempBtn.setAttribute('aria-pressed', 'false');

      $('#trackEyebrow').textContent = 'DJ_EARth / FIRST TRACK';
      $('#trackHeading').textContent = 'Hear the night lights.';
      $('#trackIntro').textContent = 'Eight places, eight piano notes. Scan an image from left to right and hear its brightness.';
      $('#trackTag').textContent = 'Nighttime light intensity → piano';
      $('#metricLabel').textContent = 'Brightness / 255';
      $('#instrumentLabel').textContent = 'Piano note';
      uploadLabel.childNodes[0].textContent = 'Upload NASA night-lights image\n';
      useEarthMapBtn.hidden = true;
      instrumentFieldset.hidden = true;
      $('#footerScaleExplanation').textContent = 'Fixed scale: floor(brightness × 7 / 256) → Do, Ré, Mi, Fa, Sol, La, Si (C4–B4). Brightness = round(0.2126R + 0.7152G + 0.0722B).';

      void loadNightLightsMap();
    }
  }

  function setMode(value) {
    if (value !== 'fixed' && value !== 'learned') return;
    stopPlayback();
    mode = value;
    pitchModes.forEach(input => { input.checked = input.value === mode; });
    $('#activeBrightness').textContent = '—';
    $('#activeNote').textContent = '—';
    $('#scanPosition').textContent = 'Choose a point';
    status.textContent = `${mode === 'fixed' ? 'Fixed scale' : 'Learn from image'} mode selected. Click any map point to listen.`;
  }

  function setBassRegister(reg) {
    if (reg !== 'deep' && reg !== 'tenor') return;
    stopPlayback();
    bassRegister = reg;
    registerModes.forEach(input => { input.checked = input.value === reg; });
    renderLearning();
    status.textContent = `Bass register set to ${reg === 'deep' ? 'Deep Bass (C2–C3 · 65–131 Hz)' : 'Tenor Bass (C3–C4 · 131–262 Hz)'}.`;
  }

  function useTestPattern() {
    imageRequest++;
    loading = false;
    playButton.disabled = false;
    upload.value = '';
    if (currentTrack === 'temperature') {
      applyImage(tempTrack.createTestPattern(), 'Temperature test pattern', true);
    } else {
      applyImage(light.createTestPattern(), 'Night lights test pattern', true);
    }
  }

  async function loadNightLightsMap() {
    const request = ++imageRequest;
    stopPlayback('Loading night-lights map...');
    loading = true;
    playButton.disabled = true;
    try {
      const decoded = new Image();
      // Data URLs remain readable by canvas when index.html is opened directly.
      decoded.src = global.DJEarthNightLightsImage || 'assets/tracks/reference-night-lights.webp';
      await decoded.decode();
      if (request !== imageRequest) return;
      const staging = document.createElement('canvas');
      staging.width = decoded.naturalWidth;
      staging.height = decoded.naturalHeight;
      const ctx = staging.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(decoded, 0, 0);
      applyImage(ctx.getImageData(0, 0, staging.width, staging.height), 'Night lights reference map', false, false);
    } catch {
      if (request === imageRequest) {
        image = undefined;
        context.clearRect(0, 0, canvas.width, canvas.height);
        status.textContent = 'Night-lights map could not be read. Open the site through a local web server or upload a night-lights image.';
      }
    } finally {
      if (request === imageRequest) {
        loading = false;
        playButton.disabled = !image;
      }
    }
  }

  async function loadEarthPresetMap() {
    const request = ++imageRequest;
    stopPlayback('Loading Earth temperature map…');
    loading = true;
    playButton.disabled = true;

    try {
      const decoded = new Image();
      await new Promise((resolve, reject) => {
        decoded.onload = resolve;
        decoded.onerror = () => reject(new Error('Could not load earth-temperature.jpg'));
        decoded.src = 'earth-temperature.jpg';
      });
      if (request !== imageRequest) return;
      const staging = document.createElement('canvas');
      staging.width = decoded.naturalWidth;
      staging.height = decoded.naturalHeight;
      const stagingContext = staging.getContext('2d', { willReadFrequently: true });
      stagingContext.drawImage(decoded, 0, 0);
      const pixels = stagingContext.getImageData(0, 0, staging.width, staging.height);
      applyImage(pixels, 'Earth temperature map', false, true);
    } catch {
      // In local file:// environments where getImageData is restricted on local files,
      // load the built-in procedural planetary thermal map:
      if (request === imageRequest) {
        applyImage(tempTrack.createEarthThermalMap(), 'Earth thermal map', false, false);
      }
    } finally {
      if (request === imageRequest) {
        loading = false;
        playButton.disabled = false;
      }
    }
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
      const staging = document.createElement('canvas');
      staging.width = decoded.naturalWidth;
      staging.height = decoded.naturalHeight;
      const stagingContext = staging.getContext('2d', { willReadFrequently: true });
      stagingContext.drawImage(decoded, 0, 0);
      const pixels = stagingContext.getImageData(0, 0, staging.width, staging.height);
      applyImage(pixels, file.name, false, false);
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

  // Event Listeners
  playButton.addEventListener('click', () => { void playScan(); });
  stopButton.addEventListener('click', () => stopPlayback());
  resetPatternBtn.addEventListener('click', useTestPattern);
  useEarthMapBtn.addEventListener('click', () => { void loadEarthPresetMap(); });

  volume.addEventListener('input', () => {
    const value = Number(volume.value);
    $('#volumeValue').textContent = `${value}%${value === 0 ? ' · silent' : ''}`;
    piano.setVolume(value / 100);
    bass.setVolume(value / 100);
  });

  pitchModes.forEach(input => input.addEventListener('change', () => {
    if (input.checked) setMode(input.value);
  }));

  registerModes.forEach(input => input.addEventListener('change', () => {
    if (input.checked) setBassRegister(input.value);
  }));

  upload.addEventListener('change', () => { void uploadImage(upload.files[0]); });

  $('#hearMapPoint').addEventListener('click', () => {
    if (!image) return;
    void previewCoordinates(Number($('#mapColumn').value) / 100 * (image.width - 1),
      Number($('#mapRow').value) / 100 * (image.height - 1));
  });

  // Interactive click on canvas to inspect/hear any location
  canvas.addEventListener('click', event => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    $('#mapColumn').value = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
    $('#mapRow').value = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
    void previewCoordinates(x, y);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlayback('Scan stopped while the page was hidden.');
  });
  global.addEventListener('pagehide', () => stopPlayback());

  // Exposed API for automated integration checks and tests
  global.djEarthApp = Object.freeze({
    playScan, previewSpot, previewCoordinates, stop: stopPlayback,
    setMode, setTrack, setBassRegister, uploadImage, useTestPattern, loadEarthPresetMap, loadNightLightsMap,
    cancelPendingImage() {
      imageRequest++;
      loading = false;
      playButton.disabled = false;
    },
    loadImageData(nextImage, name = 'Local image', isTest = false) {
      imageRequest++;
      loading = false;
      playButton.disabled = false;
      applyImage(nextImage, name, isTest);
    },
    getState: () => ({
      currentTrack, bassRegister, imageName,
      width: image ? image.width : 0,
      height: image ? image.height : 0,
      mode,
      spots: spots.map(spot => ({ ...spot })),
      centers: centers.slice(),
      noteNames: spots.map(spot => noteAt(spot)?.name || 'Rest'),
      activeIndex, scanning, loading,
      volume: Number(volume.value) / 100
    })
  });

  // Initialize with Earth Temperature track & preset map
  void loadEarthPresetMap();
})(globalThis);
