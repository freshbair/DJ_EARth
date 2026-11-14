const slider = document.querySelector('#brightness');
const swatch = document.querySelector('#swatch');
const brightnessReading = document.querySelector('#brightnessReading');
const pitchReading = document.querySelector('#pitchReading');
const amplitudeReading = document.querySelector('#amplitudeReading');
const playButton = document.querySelector('#play');
const audioStatus = document.querySelector('#audioStatus');

// One input, two sound outputs. These ranges are choices for this prototype.
function parametersForBrightness(brightness) {
  const amplitude = Math.max(0, Math.min(255, brightness)) / 255;
  return { pitch: 220 + 660 * amplitude, amplitude };
}

let audio;
let voice;
let startRequest = 0;
const maxGain = 0.15;

function ramp(parameter, target) {
  const now = audio.currentTime;
  parameter.cancelScheduledValues(now);
  parameter.setValueAtTime(parameter.value, now);
  parameter.linearRampToValueAtTime(target, now + 0.03);
}

function updateDisplay() {
  const brightness = Number(slider.value);
  const { pitch, amplitude } = parametersForBrightness(brightness);
  swatch.style.backgroundColor = `rgb(${brightness}, ${brightness}, ${brightness})`;
  brightnessReading.textContent = `${brightness} / 255`;
  pitchReading.textContent = `${pitch.toFixed(1)} Hz`;
  amplitudeReading.textContent = `${(amplitude * 100).toFixed(1)}%`;
  if (voice) {
    ramp(voice.tone.frequency, pitch);
    // Relative amplitude is scaled to a moderate output level.
    ramp(voice.gain.gain, amplitude * maxGain);
    audioStatus.textContent = amplitude === 0
      ? 'Sound on · silent at zero brightness.'
      : 'Sound on. Move brightness to hear pitch and amplitude change.';
  }
}

function stopSound() {
  startRequest++;
  if (voice) {
    const previous = voice;
    voice = undefined;
    ramp(previous.gain.gain, 0);
    previous.tone.stop(audio.currentTime + 0.04);
  }
  playButton.textContent = 'Start sound';
  playButton.setAttribute('aria-pressed', 'false');
  audioStatus.textContent = 'Sound off. Start sound, then move the slider.';
}

playButton.addEventListener('click', async () => {
  if (voice) {
    stopSound();
    return;
  }
  playButton.disabled = true;
  const request = ++startRequest;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state !== 'running') await audio.resume();
    if (request !== startRequest || document.hidden) return;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.type = 'sine';
    tone.frequency.value = parametersForBrightness(Number(slider.value)).pitch;
    gain.gain.value = 0;
    tone.connect(gain);
    gain.connect(audio.destination);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    tone.start();
    voice = { tone, gain };
    playButton.textContent = 'Stop sound';
    playButton.setAttribute('aria-pressed', 'true');
    updateDisplay();
  } catch {
    stopSound();
    audioStatus.textContent = 'Audio could not start. Try again in a browser with Web Audio support.';
  } finally {
    playButton.disabled = false;
  }
});

slider.addEventListener('input', updateDisplay);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSound();
});
updateDisplay();
