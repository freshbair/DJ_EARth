(function (global) {
  'use strict';
  const bank = global.DJEarthInstruments;
  const select = document.querySelector('#soloInstrument');
  const slider = document.querySelector('#soloValue');
  const status = document.querySelector('#soloStatus');
  const voices = new Map();
  let ticket = 0;
  let timer;
  let live = false;
  let updateLive;
  let currentVoice;
  let currentIntensity = Number(slider.value);
  // undefined uses the demo scale; null is a map rest; a number is an exact mapped pitch.
  let mapPitch;
  function applyIntensity(value = currentIntensity) {
    currentIntensity = Number(value);
    const masterVolume = Number(document.querySelector('#volume').value) / 100;
    // Keep the lowest parameter audible, with room to grow into a full-strength note.
    currentVoice?.setVolume(masterVolume * (0.1 + 0.9 * currentIntensity / 100));
  }
  const playButton = document.querySelector('#soloNote');
  const bpmForValue = value => Math.round(60 + Number(value) * 1.8);
  function updateReadout() {
    const drums = bank.assignments[Number(select.value)].id === 'drums';
    document.querySelector('#soloValueLabel').textContent = drums
      ? `${slider.value}% wind - ${bpmForValue(slider.value)} BPM`
      : `${slider.value}%`;
    const demoReadout = document.querySelector('#activeBrightness');
    if (demoReadout && Number(select.value) > 1) demoReadout.textContent = `${slider.value}%`;
    document.querySelector('#soloValueHelp').textContent = drums
      ? 'Intensity changes beat speed and loudness: 60-240 BPM. Softer beats make shorter bars.'
      : 'Intensity changes pitch and loudness. Softer notes make shorter bars; playback pace stays fixed.';
  }
  bank.assignments.forEach((assignment, index) => {
    select.add(new Option(`${assignment.parameter} → ${assignment.instrument}`, index));
  });
  select.value = '1';
  const sessionCopy = [
    ['After dark.', 'City lights. Quiet keys. Turn the brightness of our nights into a piano melody.'],
    ['Feel the heat.', 'From cool blues to warm reds. Give the temperature of our planet a harmonica voice.'],
    ['A breath of air.', 'Find a little space in the atmosphere. Explore air quality through the sound of a flute.'],
    ['Make some thunder.', 'A little electricity in the air. Meet the electric guitar behind the storm track.'],
    ['Go with the flow.', 'Ocean movement, harp strings. Find your rhythm beneath the surface.'],
    ['Catch the wind.', 'Let the breeze set the beat. Move the fader to take your drums from slow to stormy.'],
    ['Into the spiral.', 'Follow the energy of a hurricane through the sweeping sound of a violin.'],
    ['Take the high road.', 'From sea level to the summits. Explore the shape of the Earth with a little bass.']
  ];
  const trackImages = {
    0: {
      title: 'Night lights map', alt: 'World night-lights reference showing illuminated cities on dark blue land and oceans.',
      supplied: true,
      caption: 'Your night-lights reference map. Click a location to hear its image brightness, with note groups learned from this image. Values describe visual brightness, not calibrated light emissions.'
    },
    1: {
      path: 'earth-temperature.jpg', title: 'Earth temperature image',
      alt: 'Earth thermal map for temperature scanning.',
      caption: 'Map colors are mapped to temperature groups and harmonica notes.'
    },
    2: {
      file: 'reference-air-quality.png', title: 'Air quality reference map', supplied: true,
      alt: 'World map of urban air pollution deaths per million population, with a categorical legend and grey areas for no data.',
      caption: 'Your reference shows urban air pollution deaths per million population. It is not a current AQI or NO2 concentration map; the NO2 experiment below uses its own calibrated maps.'
    },
    3: {
      file: 'storms.jpg', title: 'Storms and lightning',
      source: 'https://svs.gsfc.nasa.gov/5011/',
      alt: 'Global lightning activity detected from the International Space Station.',
      caption: 'ISS Lightning Imaging Sensor observations, 2017-2023. Lightning illustrates storm activity; it does not directly measure storm intensity.'
    },
    4: {
      file: 'reference-ocean-currents.jpg', title: 'Ocean currents reference map', supplied: true,
      alt: 'Global ocean reference with coloured flow patterns and dark land areas.',
      caption: 'Your ocean currents reference. No numerical colour legend is supplied, so colours are not interpreted as measured current speeds.'
    },
    5: {
      file: 'reference-wind.jpg', title: 'Wind speed reference map', supplied: true,
      alt: 'Global Wind Atlas screenshot with the mean wind speed layer and a metres-per-second legend.',
      caption: 'Your Global Wind Atlas reference with mean wind speed selected. This screenshot is a reference, not a live wind measurement.'
    },
    6: {
      file: 'reference-hurricane.gif', title: 'Hurricane reference map', supplied: true,
      alt: 'World diagram showing tropical storm formation regions and typical hurricane, typhoon and cyclone paths.',
      caption: 'Your reference shows where tropical storms form and their typical paths. It does not show current storms or measured storm intensity.'
    },
    7: {
      file: 'reference-altitude.jpg?v=3', title: 'Altitude reference map', supplied: true,
      alt: 'Updated world elevation reference supplied by your team.',
      caption: 'Your latest world elevation reference. This image has no visible numerical legend; elevation-to-sound calibration has not been added yet.'
    }
  };
  const imagePanel = document.querySelector('#trackImagePanel');
  const trackImage = document.querySelector('#trackImage');
  trackImage.addEventListener('error', () => {
    trackImage.hidden = true;
    document.querySelector('#trackImageError').hidden = false;
  });
  const uploadedImages = new Map();
  const uploadRequests = new Map();
  const imageUpload = document.querySelector('#trackImageUpload');
  const imageUploadStatus = document.querySelector('#trackImageUploadStatus');
  function showTrackImage(index) {
    const reference = trackImages[index];
    imagePanel.hidden = !reference;
    if (!reference) return;
    const uploaded = uploadedImages.get(index);
    const source = document.querySelector('#trackImageSource');
    source.hidden = Boolean(uploaded) || !reference.source;
    const credit = document.querySelector('#trackImageCredit');
    if (credit) credit.hidden = Boolean(uploaded) || index < 2;
    if (credit) credit.textContent = reference.supplied
      ? 'Reference image supplied by your team. Original labels and watermarks are preserved.'
      : 'Image credit: NASA/Goddard Space Flight Center. Reference image only; use the sound controls to test this instrument.';
    if (imageUpload) imageUpload.value = '';
    if (imageUploadStatus) imageUploadStatus.textContent = '';
    const reset = document.querySelector('#resetTrackImage');
    if (reset) reset.disabled = false;
    document.querySelector('#trackImageTitle').textContent = uploaded ? 'Your track image' : reference.title;
    document.querySelector('#trackImageMeta').textContent = `${bank.assignments[index].parameter} - ${bank.assignments[index].instrument}`;
    if (reference.source) source.href = reference.source;
    document.querySelector('#trackImageCaption').textContent = uploaded ? uploaded.name : reference.caption;
    document.querySelector('#trackImageError').hidden = true;
    trackImage.hidden = index < 2;
    trackImage.alt = uploaded ? `${bank.assignments[index].parameter}: ${uploaded.name}` : reference.alt;
    if (index > 1) trackImage.src = uploaded ? uploaded.url : `assets/tracks/${reference.file}`;
    const help = document.querySelector('#trackImageUploadHelp');
    if (help) help.textContent = index < 2
      ? 'Choose a PNG or JPEG for this track. Images stay in your browser for this session. Click the map to hear its mapped values.'
      : 'Choose a PNG or JPEG for this track. Images stay in your browser for this session. Image analysis is coming later; sound uses demo values.';
  }
  imageUpload?.addEventListener('change', async () => {
    const index = Number(select.value);
    const file = imageUpload.files[0];
    if (!file || !trackImages[index]) return;
    const request = (uploadRequests.get(index) || 0) + 1;
    uploadRequests.set(index, request);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      imageUploadStatus.textContent = 'Please choose a PNG or JPEG image.';
      imageUpload.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    const preview = new Image();
    try {
      preview.src = url;
      await preview.decode();
      if (uploadRequests.get(index) !== request) {
        URL.revokeObjectURL(url);
        return;
      }
      const previous = uploadedImages.get(index);
      uploadedImages.set(index, { url, name: file.name, file });
      if (Number(select.value) === index) {
        showTrackImage(index);
        if (index < 2) await global.djEarthApp.uploadImage(file);
        if (Number(select.value) === index) imageUploadStatus.textContent = index < 2
          ? 'Image selected. See the scan status.'
          : 'Your image is ready for preview. Sound still uses demo values.';
      }
      if (previous) URL.revokeObjectURL(previous.url);
    } catch {
      URL.revokeObjectURL(url);
      if (Number(select.value) === index && uploadRequests.get(index) === request) {
        imageUploadStatus.textContent = 'This image could not be opened. Try another PNG or JPEG.';
        imageUpload.value = '';
      }
    }
  });
  document.querySelector('#resetTrackImage')?.addEventListener('click', () => {
    const index = Number(select.value);
    uploadRequests.set(index, (uploadRequests.get(index) || 0) + 1);
    const previous = uploadedImages.get(index);
    uploadedImages.delete(index);
    showTrackImage(index);
    if (previous) URL.revokeObjectURL(previous.url);
    if (index === 1) void global.djEarthApp.loadEarthPresetMap();
    else if (index === 0) void global.djEarthApp.loadNightLightsMap();
    imageUploadStatus.textContent = 'Default image restored.';
  });
  const trackButtons = [...document.querySelectorAll('[data-track-index]')];
  trackButtons.forEach(button => button.addEventListener('click', () => {
    mapPitch = undefined;
    stop();
    const index = Number(button.dataset.trackIndex);
    const assignment = bank.assignments[index];
    const demo = index > 1;
    // Additional tracks use isolated demo values until their data sources are added.
    global.djEarthApp.cancelPendingImage?.();
    global.djEarthApp.setTrack(index === 1 ? 'temperature' : 'light');
    global.djEarthApp.stop('Ready to test the selected track.');
    select.value = String(index);
    updateReadout();
    document.body.classList.toggle('demo-track', demo);
    showTrackImage(index);
    if (imageUpload) {
      document.querySelector('#scanPending').hidden = !demo;
      document.querySelector('#playScan').disabled = demo;
      document.querySelector('#stopScan').disabled = true;
      document.querySelector('#volumeHelp').textContent = 'Volume changes loudness only; it does not change the selected map value or pitch.';
      document.querySelector('#footerScaleExplanation').textContent = demo
        ? 'This track uses demo values. Uploaded images are previews until image analysis is added.'
        : 'Click anywhere on the map. The selected pixel maps to a note using the current colour scale.';
      if (demo) {
        document.querySelector('#metricLabel').textContent = `${assignment.parameter} / demo`;
        document.querySelector('#instrumentLabel').textContent = `${assignment.instrument} preview`;
        document.querySelector('#activeBrightness').textContent = `${slider.value}%`;
        document.querySelector('#activeNote').textContent = 'Use demo controls';
        document.querySelector('#scanPosition').textContent = 'Pending';
        document.querySelector('#status').textContent = 'Image scanning is coming later for this track.';
        document.querySelector('#learningTitle').textContent = 'Image analysis';
        document.querySelector('#learningSummary').textContent = 'Image analysis is coming later for this track. Your uploaded image is available for preview.';
      } else {
        global.djEarthApp.setMode('learned');
        const uploaded = uploadedImages.get(index);
        if (uploaded) void global.djEarthApp.uploadImage(uploaded.file);
        else if (index === 1) void global.djEarthApp.loadEarthPresetMap();
        else void global.djEarthApp.loadNightLightsMap();
      }
    }
    trackButtons.forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#trackEyebrow').textContent = `SIDE A / TRACK ${String(index + 1).padStart(2, '0')}`;
    document.body.dataset.track = String(index);
    document.querySelector('#soloTitle').textContent = 'Find your sound.';
    document.querySelector('#soloAssignment').textContent = `${assignment.parameter} → ${assignment.instrument}`;
    status.textContent = `${assignment.instrument} ready. Press Play live and move the slider, or play a test phrase.`;
    {
      document.querySelector('#trackHeading').textContent = sessionCopy[index][0];
      document.querySelector('#trackIntro').textContent = sessionCopy[index][1];
      document.querySelector('#trackTag').textContent = `${assignment.parameter} - ${assignment.instrument}`;
    }
  }));
  function stop() {
    ticket++;
    clearTimeout(timer);
    live = false;
    updateLive = undefined;
    playButton.setAttribute('aria-pressed', 'false');
    document.body.classList.remove('is-playing');
    voices.forEach(voice => voice.stopAll());
    currentVoice = undefined;
    status.textContent = 'Solo stopped. Ready to test another value or instrument.';
  }
  async function play(playbackMode) {
    const phrase = playbackMode === 'phrase';
    stop();
    global.djEarthApp.stop('Map scan stopped for solo instrument test.');
    const run = ticket;
    const assignment = bank.assignments[Number(select.value)];
    let voice = voices.get(assignment.id);
    if (!voice) {
      voice = bank.createInstrument(assignment.id);
      voices.set(assignment.id, voice);
    }
    currentVoice = voice;
    applyIntensity(slider.value);
    live = playbackMode === 'live';
    playButton.setAttribute('aria-pressed', String(live));
    status.textContent = 'Preparing instrument...';
    try {
      await voice.ready();
      if (run !== ticket) return;
      document.body.classList.add('is-playing');
      if (live) {
        let beat = 0;
        let lastBeat = 0;
        let interval = 500;
        function playMelody() {
          if (mapPitch !== undefined) {
            if (mapPitch !== null) voice.play(mapPitch);
            return;
          }
          const intervals = [0, 2, 4, 5, 7, 9, 11, 12];
          const midi = (assignment.octave + 1) * 12 + intervals[Math.round(Number(slider.value) * 7 / 100)];
          voice.play(440 * 2 ** ((midi - 69) / 12));
        }
        function showLiveStatus() {
          status.textContent = mapPitch === null
            ? 'Playing live: this map point is a rest. Choose another point to hear it.'
            : `${assignment.parameter} - ${assignment.instrument}: ${slider.value}%${assignment.id === 'drums' ? ` - ${bpmForValue(slider.value)} BPM` : ''}. Playing live; move the slider or choose a map point to change the sound.`;
        }
        function tick() {
          if (run !== ticket) return;
          try {
            const value = Number(slider.value);
            applyIntensity(value);
            if (assignment.id === 'drums') {
              // A stable kick/snare pattern; wind changes tempo, not drum type.
              voice.play(beat++ % 2 === 0 ? 65 : 110);
              lastBeat = performance.now();
              interval = 60000 / bpmForValue(value);
            } else {
              playMelody();
              interval = 500;
            }
            showLiveStatus();
            timer = setTimeout(tick, interval);
          } catch (error) {
            stop();
            status.textContent = `Audio could not play: ${error.message}`;
          }
        }
        updateLive = () => {
          if (run !== ticket) return;
          applyIntensity(slider.value);
          if (assignment.id === 'drums') {
            clearTimeout(timer);
            // Preserve progress through the beat when its duration changes.
            const now = performance.now();
            const progress = Math.min(1, Math.max(0, (now - lastBeat) / interval));
            interval = 60000 / bpmForValue(slider.value);
            lastBeat = now - progress * interval;
            timer = setTimeout(tick, (1 - progress) * interval);
            showLiveStatus();
          } else {
            // Preview the new pitch without restarting the fixed repeat clock.
            try {
              voice.stopAll();
              playMelody();
              showLiveStatus();
            } catch (error) {
              stop();
              status.textContent = `Audio could not play: ${error.message}`;
            }
          }
        };
        tick();
        return;
      }
      const values = phrase ? [0, 14, 29, 43, 57, 71, 86, 100] : [Number(slider.value)];
      let index = 0;
      const intervals = [0, 2, 4, 5, 7, 9, 11, 12];
      function step() {
        if (run !== ticket) return;
        const value = values[index++];
        applyIntensity(value);
        const semitone = intervals[Math.round(value * 7 / 100)];
        const midi = (assignment.octave + 1) * 12 + semitone;
        voice.play(assignment.id === 'drums' ? (index % 2 === 1 ? 65 : 110) : 440 * 2 ** ((midi - 69) / 12));
        status.textContent = `${assignment.parameter} → ${assignment.instrument}: demo value ${value}%${assignment.id === 'drums' ? ` - ${bpmForValue(value)} BPM` : ''}.`;
        if (index < values.length) timer = setTimeout(step, assignment.id === 'drums' ? 60000 / bpmForValue(value) : 500);
        else timer = setTimeout(() => {
          if (run === ticket) { stop(); status.textContent = `${assignment.instrument} test complete.`; }
        }, Math.max(1100, (voice.tailSeconds || 0.95) * 1000 + 50));
      }
      step();
    } catch (error) {
      if (run === ticket) { stop(); status.textContent = `Audio could not play: ${error.message}`; }
    }
  }
  select.addEventListener('change', () => { mapPitch = undefined; stop(); });
  slider.addEventListener('input', () => {
    mapPitch = undefined;
    updateReadout();
    if (live) updateLive?.();
  });
  document.querySelector('#soloNote').addEventListener('click', () => { void play('live'); });
  document.querySelector('#soloSingle').addEventListener('click', () => { void play('single'); });
  document.querySelector('#soloPhrase').addEventListener('click', () => { void play('phrase'); });
  document.querySelector('#soloStop').addEventListener('click', stop);
  document.querySelector('#volume').addEventListener('input', () => applyIntensity());
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  global.addEventListener('pagehide', stop);
  global.djEarthSolo = Object.freeze({
    stop,
    applyMapPoint(intensity, hz) {
      if (Number(select.value) > 1) return false;
      if (!live) stop();
      if (Number.isFinite(intensity)) {
        slider.value = Math.max(0, Math.min(100, Math.round(intensity)));
        updateReadout();
      }
      mapPitch = hz;
      if (live) {
        document.body.classList.add('is-playing');
        updateLive?.();
      }
      return live;
    }
  });
  updateReadout();
  if (imageUpload) trackButtons.find(button => button.dataset.trackIndex === '0').click();
})(globalThis);
