(function (global) {
  'use strict';
  const bank = global.DJEarthInstruments;
  const select = document.querySelector('#soloInstrument');
  const slider = document.querySelector('#soloValue');
  const status = document.querySelector('#soloStatus');
  const voices = new Map();
  let ticket = 0;
  let timer;
  bank.assignments.forEach((assignment, index) => {
    select.add(new Option(`${assignment.parameter} → ${assignment.instrument}`, index));
  });
  select.value = '1';
  const trackImages = {
    2: {
      file: 'air-quality.png', title: 'Air quality model',
      source: 'https://svs.gsfc.nasa.gov/5533/',
      alt: 'NASA visualization of modeled air pollutants around the Earth.',
      caption: 'GEOS-CF air pollutant transport, July-August 2024. This is a model visualization, not a direct AQI reading.'
    },
    3: {
      file: 'storms.jpg', title: 'Storms and lightning',
      source: 'https://svs.gsfc.nasa.gov/5011/',
      alt: 'Global lightning activity detected from the International Space Station.',
      caption: 'ISS Lightning Imaging Sensor observations, 2017-2023. Lightning illustrates storm activity; it does not directly measure storm intensity.'
    },
    4: {
      file: 'ocean-currents.jpg', title: 'Ocean surface currents',
      source: 'https://svs.gsfc.nasa.gov/3912/',
      alt: 'Global ocean current paths colored by sea surface temperature.',
      caption: 'ECCO2 modeled surface currents, 2007-2008. Colors represent sea surface temperature, not current speed.'
    },
    5: {
      file: 'wind.jpg', title: 'Atmospheric transport',
      source: 'https://svs.gsfc.nasa.gov/4960/',
      alt: 'NASA atmospheric river visualization showing clouds and moisture transport.',
      caption: 'Atmospheric river reference from NASA MERRA-2. This illustrates atmospheric transport rather than a quantitative wind speed map.'
    },
    6: {
      file: 'hurricane.jpg', title: 'Hurricane tracks',
      source: 'https://svs.gsfc.nasa.gov/4947/',
      alt: '2021 hurricane tracks over clouds, precipitation, and sea surface temperatures.',
      caption: 'May-September 2021 hurricane season. This composite combines storm tracks, clouds, precipitation, and ocean temperatures.'
    },
    7: {
      file: 'altitude.jpg', title: 'Terrain elevation',
      source: 'https://svs.gsfc.nasa.gov/11734',
      alt: 'ASTER color-coded terrain elevation visualization.',
      caption: 'NASA/JPL/METI/ASTER Team elevation visualization. Purple indicates low terrain; orange, red, and white indicate higher terrain.'
    }
  };
  const imagePanel = document.querySelector('#trackImagePanel');
  const trackImage = document.querySelector('#trackImage');
  trackImage.addEventListener('error', () => {
    trackImage.hidden = true;
    document.querySelector('#trackImageError').hidden = false;
  });
  function showTrackImage(index) {
    const reference = trackImages[index];
    imagePanel.hidden = !reference;
    if (!reference) return;
    document.querySelector('#trackImageTitle').textContent = reference.title;
    document.querySelector('#trackImageMeta').textContent = `${bank.assignments[index].parameter} - ${bank.assignments[index].instrument}`;
    document.querySelector('#trackImageSource').href = reference.source;
    document.querySelector('#trackImageCaption').textContent = reference.caption;
    document.querySelector('#trackImageError').hidden = true;
    trackImage.hidden = false;
    trackImage.alt = reference.alt;
    trackImage.src = `assets/tracks/${reference.file}`;
  }
  const trackButtons = [...document.querySelectorAll('[data-track-index]')];
  trackButtons.forEach(button => button.addEventListener('click', () => {
    stop();
    const index = Number(button.dataset.trackIndex);
    const assignment = bank.assignments[index];
    const demo = index > 1;
    // Additional tracks use isolated demo values until their data sources are added.
    if (demo) global.djEarthApp.setTrack('light');
    global.djEarthApp.stop('Ready to test the selected track.');
    select.value = String(index);
    document.body.classList.toggle('demo-track', demo);
    showTrackImage(index);
    trackButtons.forEach(tab => {
      const active = tab === button;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#trackEyebrow').textContent = `DJ_EARth / TRACK ${index + 1}`;
    document.querySelector('#soloTitle').textContent = `Test ${assignment.parameter.toLowerCase()} alone`;
    document.querySelector('#soloAssignment').textContent = `${assignment.parameter} → ${assignment.instrument}`;
    status.textContent = `${assignment.instrument} ready. Play a value or test phrase.`;
    if (demo) {
      document.querySelector('#trackHeading').textContent = `Hear the Earth's ${assignment.parameter.toLowerCase()}.`;
      document.querySelector('#trackIntro').textContent = `Test ${assignment.parameter.toLowerCase()} with ${assignment.instrument.toLowerCase()}. Adjust the demo value or play an eight-step phrase to hear this track on its own.`;
      document.querySelector('#trackTag').textContent = `${assignment.parameter} → ${assignment.instrument} · Demo values`;
    }
  }));
  function stop() {
    ticket++;
    clearTimeout(timer);
    voices.forEach(voice => voice.stopAll());
    status.textContent = 'Solo stopped. Ready to test another value or instrument.';
  }
  async function play(phrase) {
    stop();
    global.djEarthApp.stop('Map scan stopped for solo instrument test.');
    const run = ticket;
    const assignment = bank.assignments[Number(select.value)];
    let voice = voices.get(assignment.id);
    if (!voice) {
      voice = bank.createInstrument(assignment.id);
      voices.set(assignment.id, voice);
    }
    voice.setVolume(Number(document.querySelector('#volume').value) / 100);
    try {
      await voice.ready();
      if (run !== ticket) return;
      const values = phrase ? [0, 14, 29, 43, 57, 71, 86, 100] : [Number(slider.value)];
      let index = 0;
      const intervals = [0, 2, 4, 5, 7, 9, 11, 12];
      function step() {
        if (run !== ticket) return;
        const value = values[index++];
        const semitone = intervals[Math.round(value * 7 / 100)];
        const midi = (assignment.octave + 1) * 12 + semitone;
        voice.play(440 * 2 ** ((midi - 69) / 12));
        status.textContent = `${assignment.parameter} → ${assignment.instrument}: demo value ${value}%${assignment.id === 'drums' ? ' (kick / snare / hi-hat)' : ''}.`;
        if (index < values.length) timer = setTimeout(step, 500);
        else timer = setTimeout(() => {
          if (run === ticket) { stop(); status.textContent = `${assignment.instrument} test complete.`; }
        }, 1100);
      }
      step();
    } catch (error) {
      if (run === ticket) { stop(); status.textContent = `Audio could not play: ${error.message}`; }
    }
  }
  select.addEventListener('change', stop);
  slider.addEventListener('input', () => { document.querySelector('#soloValueLabel').textContent = `${slider.value}%`; });
  document.querySelector('#soloNote').addEventListener('click', () => { void play(false); });
  document.querySelector('#soloPhrase').addEventListener('click', () => { void play(true); });
  document.querySelector('#soloStop').addEventListener('click', stop);
  document.querySelector('#volume').addEventListener('input', event => {
    voices.forEach(voice => voice.setVolume(Number(event.target.value) / 100));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  global.addEventListener('pagehide', stop);
  global.djEarthSolo = Object.freeze({ stop });
})(globalThis);
