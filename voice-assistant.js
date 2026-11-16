(function(global) {
  'use strict';

  const $ = id => document.getElementById(id);
  const player = global.DJEarthCountryTemperature;
  const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;

  let enabled = false;
  let phase = 'off'; // 'off' | 'wake' | 'country' | 'speaking' | 'loading' | 'playing'
  let recognizer = null;
  let restartTimer = null;
  let transcriptTimer = null;
  let run = 0;
  let audio = null;
  let cancelSpeech = null;
  let resumeOnVisible = false;
  let welcomed = false;
  let welcoming = false;
  let lastRetry = 0;

  const introduction = 'Say hey DJ to get the weather update.';

  function open() {
    const assistant = $('voiceAssistant');
    if (assistant) assistant.hidden = false;
    const launcher = $('djLauncher');
    if (launcher) launcher.setAttribute('aria-expanded', 'true');
    const title = $('djVoiceTitle');
    if (title) title.focus({ preventScroll: true });
  }

  function close() {
    const assistant = $('voiceAssistant');
    if (assistant) assistant.hidden = true;
    const launcher = $('djLauncher');
    if (launcher) {
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus({ preventScroll: true });
    }
  }

  function status(text) {
    const el = $('djVoiceStatus');
    if (el) el.textContent = text;
  }

  function showTranscript(text, type = 'user') {
    const box = $('djLiveTranscript');
    if (!box) return;
    box.textContent = text;
    box.className = `dj-live-transcript dj-transcript-${type}`;

    if (type === 'user') {
      clearTimeout(transcriptTimer);
      transcriptTimer = setTimeout(() => {
        if (enabled && phase === 'country') {
          showTranscript('Listening for country name...', 'system');
        } else if (enabled && ['wake', 'playing'].includes(phase)) {
          showTranscript('Listening for "Hey DJ"...', 'system');
        }
      }, 4000);
    }
  }

  function updateMicUI(isListening) {
    const state = $('djMicState');
    const enableBtn = $('djEnable');
    const launcher = $('djLauncher');
    if (isListening) {
      if (state) state.textContent = 'Listening 🎙️';
      if (enableBtn) {
        enableBtn.textContent = 'Disable microphone';
        enableBtn.setAttribute('aria-pressed', 'true');
      }
      if (launcher) launcher.classList.add('is-listening');
    } else {
      if (state) state.textContent = 'Mic off';
      if (enableBtn) {
        enableBtn.textContent = 'Enable microphone';
        enableBtn.removeAttribute('aria-pressed');
      }
      if (launcher) launcher.classList.remove('is-listening');
    }
  }

  function suspend() {
    clearTimeout(restartTimer);
    const r = recognizer;
    recognizer = null;
    if (r) {
      r.onend = null;
      r.onresult = null;
      r.onerror = null;
      try { r.abort(); } catch {}
    }
  }

  function stop() {
    run++;
    welcomed = true;
    removeWelcomeRetry();
    enabled = false;
    phase = 'off';
    clearTimeout(restartTimer);
    suspend();
    cancelSpeech?.();
    try { global.speechSynthesis?.cancel(); } catch {}
    player?.stop();
    updateMicUI(false);
    status('Voice assistant stopped. Microphone is not listening.');
    const melody = $('djMelody');
    if (melody) melody.textContent = 'Melody stopped.';
    showTranscript('Microphone off. Click Enable microphone to start.', 'system');
  }

  function listen() {
    if (welcoming || !enabled || recognizer || !Recognition || !['wake', 'country', 'playing'].includes(phase) || document.hidden) return;

    try {
      const r = new Recognition();
      recognizer = r;
      r.lang = 'en-US';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 5;

      r.onresult = e => {
        if (recognizer !== r || welcoming || phase === 'speaking' || !['wake', 'country', 'playing'].includes(phase)) return;

        let finalTranscript = '';
        let interimTranscript = '';
        const allAlternatives = [];

        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const primary = res[0]?.transcript || '';
          if (res.isFinal) {
            finalTranscript += primary + ' ';
          } else {
            interimTranscript += primary + ' ';
          }
          for (let j = 0; j < res.length; j++) {
            const altText = res[j]?.transcript?.trim();
            if (altText) allAlternatives.push(altText);
          }
        }

        const heardText = (finalTranscript || interimTranscript).trim();
        if (heardText) {
          showTranscript(`Heard: "${heardText}"`, 'user');
        }

        // Global stop / cancel check
        if (allAlternatives.some(t => /^(stop|stop dj|stop music|stop assistant|cancel|mute)$/i.test(t.replace(/[.,!?]/g, '').trim()))) {
          stop();
          return;
        }

        if (phase === 'country') {
          let matchedCountry = null;
          for (const text of allAlternatives) {
            const resolved = player?.resolve(text);
            if (resolved) {
              matchedCountry = resolved;
              break;
            }
          }

          if (matchedCountry) {
            showTranscript(`Detected: ${matchedCountry.name}`, 'success');
            void country(null, matchedCountry);
          } else if (finalTranscript.trim()) {
            void retryCountry();
          }
        } else {
          // Phase is 'wake' or 'playing'
          const wakePattern = /\b(hey|hi|hello|ok|okay|play|yo|start|wake)?\s*(dj|d\s*j|deejay)\b/i;
          const wakeMatch = allAlternatives.some(t => wakePattern.test(t));

          let attachedCountry = null;
          for (const text of allAlternatives) {
            const resolved = player?.resolve(text);
            if (resolved) {
              attachedCountry = resolved;
              break;
            }
          }

          if (wakeMatch) {
            if (attachedCountry) {
              // Direct compound wake + country! e.g. "Hey DJ Lebanon" or "Hey DJ play France"
              void wake(attachedCountry);
            } else {
              void wake();
            }
          } else if (!$('voiceAssistant').hidden && attachedCountry) {
            // Panel is open and user directly stated their country
            void country(null, attachedCountry);
          }
        }
      };

      r.onnomatch = () => {
        if (recognizer === r && phase === 'country') {
          void retryCountry();
        }
      };

      r.onend = () => {
        if (recognizer !== r) return;
        recognizer = null;
        // Auto-reconnect seamlessly if assistant is still enabled
        if (enabled && phase !== 'off' && phase !== 'speaking' && !document.hidden && !welcoming) {
          clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            if (enabled && !recognizer && phase !== 'off' && phase !== 'speaking' && !document.hidden) {
              listen();
            }
          }, 150);
        } else if (!enabled || phase === 'off') {
          updateMicUI(false);
          status('Microphone off.');
        }
      };

      r.onerror = e => {
        if (recognizer !== r) return;
        if (e.error === 'no-speech' || e.error === 'aborted') {
          return; // Normal browser events, onend will handle restart if needed
        }
        if (e.error === 'not-allowed') {
          stop();
          const isFile = global.location.protocol === 'file:';
          const msg = isFile
            ? 'Speech recognition is blocked on local file:// URLs. Please run DJ_EARth using a local server (e.g. VS Code Live Server or start-server.bat) or use the buttons below.'
            : 'Microphone permission was not allowed. Please allow microphone access in your browser address bar.';
          status(msg);
          showTranscript(msg, 'error');
          return;
        }
        if (e.error === 'network') {
          status('Speech recognition network glitch. Reconnecting...');
          return;
        }
        status(`Voice recognition: ${e.error}. Try typing your country or clicking below.`);
      };

      r.start();
      updateMicUI(true);
    } catch {
      recognizer = null;
      stop();
      status('Could not start microphone. Check browser permissions or run on a local server.');
    }
  }

  async function retryCountry() {
    if (phase !== 'country' || welcoming || Date.now() - lastRetry < 4000) return;
    lastRetry = Date.now();
    const current = run;
    phase = 'speaking';
    suspend();
    await speak('I did not catch that clearly. Please say just the country name.');
    if (current === run) {
      phase = 'country';
      status('Listening for country name... (e.g., "Lebanon", "United States", "France")');
      showTranscript('Listening for country name...', 'system');
      listen();
    }
  }

  function speak(text) {
    status(text);
    return new Promise(resolve => {
      if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) {
        resolve();
        return;
      }
      try { global.speechSynthesis.cancel(); } catch {}
      let done = false;
      const finish = (success = false) => {
        if (done) return;
        done = true;
        clearTimeout(timeout);
        cancelSpeech = null;
        resolve(success);
      };
      const timeout = setTimeout(finish, 5000);
      cancelSpeech = finish;

      try {
        const utterance = new global.SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.0;
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        if (global.speechSynthesis.paused) {
          global.speechSynthesis.resume();
        }
        global.speechSynthesis.speak(utterance);
      } catch {
        finish();
      }
    });
  }

  async function chime() {
    audio ||= new (global.AudioContext || global.webkitAudioContext)();
    await Promise.race([audio.resume(), new Promise(resolve => setTimeout(resolve, 800))]);
    if (audio.state !== 'running') throw Error('Click anywhere on the page to enable sound, then say Hey DJ again.');
    const now = audio.currentTime;
    [660, 880].forEach((hz, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = hz;
      o.connect(g);
      g.connect(audio.destination);
      g.gain.setValueAtTime(0, now + i * .12);
      g.gain.linearRampToValueAtTime(.07, now + i * .12 + .015);
      g.gain.linearRampToValueAtTime(0, now + i * .12 + .12);
      o.start(now + i * .12);
      o.stop(now + i * .12 + .13);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    });
    await new Promise(r => setTimeout(r, 280));
  }

  async function wake(preselectedCountry = null) {
    open();
    const current = ++run;
    phase = 'speaking';
    suspend();
    cancelSpeech?.();
    try { global.speechSynthesis?.cancel(); } catch {}
    player?.stop();
    global.djEarthApp?.stop();
    global.djEarthSolo?.stop();

    try {
      await chime();
    } catch (error) {
      if (current === run) {
        phase = 'wake';
        status(error.message);
        listen();
      }
      return;
    }
    if (current !== run) return;

    if (preselectedCountry) {
      await country(null, preselectedCountry);
      return;
    }

    await speak('What country are you in right now?');
    if (current !== run) return;
    phase = 'country';
    status(enabled ? 'Listening for your country. You can say: "I am in Lebanon" or just the country name.' : 'Type your country below or enable microphone.');
    showTranscript('Listening for country name...', 'system');
    listen();
  }

  async function country(text, location) {
    if (document.body.dataset.track !== '1') document.querySelector('[data-track-index="1"]')?.click();
    const current = ++run;
    phase = 'loading';
    suspend();
    cancelSpeech?.();
    try { global.speechSynthesis?.cancel(); } catch {}
    player?.stop();

    const selected = location || player?.resolve(text);
    if (!selected) {
      phase = 'speaking';
      await speak('I did not recognize that country. Please say its full name.');
      if (current !== run) return;
      phase = 'country';
      showTranscript('Country not recognized. Try again.', 'error');
      listen();
      return;
    }

    status(`Preparing the temperature melody for ${selected.name}...`);
    showTranscript(`Selected: ${selected.name}`, 'success');

    try {
      const prepared = await player.prepare(selected);
      if (current !== run) return;
      const forecast = $('djForecast');
      if (forecast) forecast.textContent = prepared.announcement;
      phase = 'playing';
      prepared.start();
      status(`Playing temperature melody for ${selected.name}. ${enabled ? 'Say "stop" or "Hey DJ".' : 'Use Stop assistant to end playback.'}`);
      listen();
    } catch (error) {
      if (current !== run) return;
      phase = 'speaking';
      await speak(error.message || 'The reference melody could not start. Please try again.');
      if (current !== run) return;
      phase = 'country';
      listen();
    }
  }

  function enable() {
    if (enabled) return;
    if (!Recognition) {
      status('Voice recognition is not supported in this browser. Try Chrome or Edge, or type your country below.');
      showTranscript('Speech recognition not supported in this browser.', 'error');
      return;
    }
    enabled = true;
    phase = 'wake';
    updateMicUI(true);
    void player?.prime().catch(() => {});
    try {
      audio ||= new (global.AudioContext || global.webkitAudioContext)();
      void audio.resume();
    } catch {}
    status('Microphone listening! Say "Hey DJ" or say your country.');
    showTranscript('Listening for "Hey DJ"...', 'system');
    listen();
  }

  async function welcome() {
    if (welcomed || welcoming || !['off', 'wake'].includes(phase) || document.hidden) return;
    welcoming = true;
    const current = run;
    suspend();
    try {
      const spoken = await speak(introduction);
      if (current === run && spoken) {
        welcomed = true;
        removeWelcomeRetry();
      }
    } finally {
      welcoming = false;
      if (current === run && enabled) listen();
    }
  }

  // Browsers may require a gesture before allowing speech. Retry only until
  // the greeting succeeds, and let explicit assistant controls take priority.
  function retryWelcome(event) {
    if (event?.target?.closest?.('#djStop, #djClose, #djEnable, #djAsk, #djWelcome, .quick-country-btn')) return;
    void welcome();
  }

  function removeWelcomeRetry() {
    document.removeEventListener('pointerdown', retryWelcome);
    document.removeEventListener('keydown', retryWelcome);
  }

  function primeAudio(event) {
    if (event?.target?.closest?.('#djStop, #djEnable, #djAsk, #djWelcome, .quick-country-btn')) return;
    void player?.prime().catch(() => {});
    try {
      audio ||= new (global.AudioContext || global.webkitAudioContext)();
      void audio.resume();
    } catch {}
  }

  // Event Listeners
  const launcher = $('djLauncher');
  if (launcher) {
    launcher.addEventListener('click', () => {
      const assistant = $('voiceAssistant');
      if (assistant && assistant.hidden) {
        open();
        if (!enabled) {
          enable();
        }
      } else {
        close();
      }
    });
  }

  const closeBtn = $('djClose');
  if (closeBtn) closeBtn.addEventListener('click', close);

  const assistantSec = $('voiceAssistant');
  if (assistantSec) {
    assistantSec.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        close();
        e.preventDefault();
      }
    });
  }

  const enableBtn = $('djEnable');
  if (enableBtn) {
    enableBtn.addEventListener('click', () => {
      if (enabled) stop();
      else enable();
    });
  }

  const askBtn = $('djAsk');
  if (askBtn) {
    askBtn.addEventListener('click', () => {
      enable();
      void wake();
    });
  }

  const stopBtn = $('djStop');
  if (stopBtn) stopBtn.addEventListener('click', stop);

  const welcomeBtn = $('djWelcome');
  if (welcomeBtn) {
    welcomeBtn.addEventListener('click', async () => {
      stop();
      welcomed = false;
      // Let an interrupted greeting finish its cleanup before replaying it.
      await Promise.resolve();
      void welcome();
    });
  }

  const form = $('djCountryForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('djCountry');
      if (input && input.value) {
        void country(input.value);
      }
    });
  }

  document.querySelectorAll('.quick-country-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cName = btn.dataset.country;
      if (cName) {
        const resolved = player?.resolve(cName);
        if (resolved) void country(null, resolved);
      }
    });
  });

  const datalist = $('djCountries');
  if (datalist && global.DJEarthCountries) {
    for (const c of global.DJEarthCountries) {
      const o = document.createElement('option');
      o.value = c.name;
      datalist.append(o);
    }
  }

  document.addEventListener('pointerdown', primeAudio, { once: true });
  document.addEventListener('keydown', primeAudio, { once: true });
  if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
    document.addEventListener('pointerdown', retryWelcome);
    document.addEventListener('keydown', retryWelcome);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeOnVisible = enabled;
      suspend();
    } else if (resumeOnVisible) {
      resumeOnVisible = false;
      if (enabled && !recognizer) listen();
    }
    if (!document.hidden) void welcome();
  });

  global.addEventListener('pagehide', stop);

  for (const el of document.querySelectorAll('[data-track-index], #soloNote, #soloSingle, #soloPhrase, #soloStop, #stopScan, #sourceCanvas, #hearMapPoint, #no2Play, #no2Reference')) {
    el.addEventListener('click', () => {
      if (phase === 'playing') {
        player?.stop();
        phase = 'wake';
        const melody = $('djMelody');
        if (melody) melody.textContent = 'Melody stopped by studio interaction.';
      }
    });
  }

  if (global.location.protocol === 'file:') {
    const notice = $('fileProtocolNotice');
    if (notice) notice.hidden = false;
  }

  if (!Recognition) {
    status('Voice recognition is not supported in this browser. Try Chrome or Edge.');
  }

  global.DJEarthVoice = Object.freeze({
    stop,
    getState: () => ({ enabled, phase })
  });

  async function checkPermission() {
    if (!Recognition || document.hidden) return;
    if (global.location.protocol === 'file:') {
      status('Note: Chrome blocks microphone speech-to-text on file://. Use a local server or type your country below.');
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      if (permission.state === 'granted') {
        enable();
      }
      permission.onchange = () => {
        if (permission.state === 'granted' && !document.hidden && !enabled) {
          enable();
        } else if (permission.state === 'denied') {
          stop();
        }
      };
    } catch {}
  }

  void checkPermission();
  // This deferred script runs afresh on every page load and reload.
  void welcome();
})(globalThis);
