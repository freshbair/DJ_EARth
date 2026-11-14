const slider = document.querySelector("#brightness");
const swatch = document.querySelector("#swatch");
const reading = document.querySelector("#reading");
const playButton = document.querySelector("#play");

const notes = [
  { name: "Do (C4)",  hz: 261.63 },
  { name: "Ré (D4)",  hz: 293.66 },
  { name: "Mi (E4)",  hz: 329.63 },
  { name: "Fa (F4)",  hz: 349.23 },
  { name: "Sol (G4)", hz: 392.00 },
  { name: "La (A4)",  hz: 440.00 },
  { name: "Si (B4)",  hz: 493.88 }
];

function noteForBrightness(value) {
  // Split the 256 possible brightness values into seven note ranges.
  return notes[Math.floor(value * notes.length / 256)];
}

function updateDisplay() {
  const value = Number(slider.value);
  swatch.style.backgroundColor = `rgb(${value}, ${value}, ${value})`;
  reading.textContent = `${value} / 255 → ${noteForBrightness(value).name}`;
  document.querySelectorAll('.piano-key').forEach((key, i) => {
    const selected = notes[i] === noteForBrightness(value);
    key.classList.toggle('selected', selected);
  });
}

let audio;

const shortcuts = ['a', 's', 'd', 'f', 'g', 'h', 'j'];
const piano = document.querySelector('#piano');
notes.forEach((note, i) => {
  const low = Math.ceil(i * 256 / notes.length);
  const high = Math.ceil((i + 1) * 256 / notes.length) - 1;
  const key = document.createElement('button');
  key.type = 'button';
  key.className = 'piano-key';
  key.style.setProperty('--brightness', Math.round((low + high) / 2));
  key.setAttribute('aria-label', `${note.name}, brightness ${low} to ${high}`);
  key.innerHTML = `<span class="brightness-chip"></span><span class="key-range">${low}–${high}</span><strong>${note.name.split(' (')[0]}</strong><kbd>${shortcuts[i].toUpperCase()}</kbd>`;
  key.addEventListener('click', () => {
    slider.value = Math.round((low + high) / 2);
    updateDisplay();
    playButton.click();
  });
  piano.append(key);
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const i = shortcuts.indexOf(event.key.toLowerCase());
  if (i < 0) return;
  event.preventDefault();
  piano.children[i].click();
});

playButton.addEventListener("click", async () => {
  const note = noteForBrightness(Number(slider.value));
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    await audio.resume();
  } catch {
    reading.textContent = 'Audio could not start. Try a browser with Web Audio support.';
    return;
  }
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  const now = audio.currentTime;

  tone.type = "sine";
  tone.frequency.value = note.hz;
  tone.connect(volume);
  volume.connect(audio.destination);

  // Fade in and out so the note starts and ends smoothly.
  volume.gain.setValueAtTime(0, now);
  volume.gain.linearRampToValueAtTime(0.15, now + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  tone.start(now);
  tone.stop(now + 0.51);
  tone.onended = () => {
    tone.disconnect();
    volume.disconnect();
  };
});

slider.addEventListener("input", updateDisplay);
updateDisplay();
const imageFile = document.querySelector("#imageFile");
const canvas = document.querySelector("#earthImage");
const hint = document.querySelector("#imageHint");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

let sampleX = 0;
let sampleY = 0;
let loadNumber = 0;

imageFile.addEventListener("change", async () => {
  const file = imageFile.files[0];
  if (!file) return;

  const currentLoad = ++loadNumber;
  const url = URL.createObjectURL(file);
  const img = new Image();
  canvas.hidden = true;

  try {
    img.src = url;
    await img.decode();
    if (currentLoad !== loadNumber) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);

    sampleX = Math.floor(canvas.width / 2);
    sampleY = Math.floor(canvas.height / 2);
    canvas.hidden = false;
    hint.textContent = "Click a spot to hear it. With the image focused, " +
      "use the arrow keys to move or Enter to play the current spot.";
  } catch {
    if (currentLoad === loadNumber) {
      hint.textContent = "That image could not be opened. Try a PNG or JPG.";
    }
  } finally {
    URL.revokeObjectURL(url);
  }
});

function playPixel(x, y) {
  sampleX = Math.max(0, Math.min(canvas.width - 1, x));
  sampleY = Math.max(0, Math.min(canvas.height - 1, y));

  const [r, g, b, alpha] = ctx.getImageData(sampleX, sampleY, 1, 1).data;
  if (alpha === 0) {
    hint.textContent = "Transparent pixel. Choose another spot.";
    return;
  }

  // Perceived brightness: green contributes more than red or blue.
  const brightness = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

  slider.value = brightness;
  updateDisplay();
  playButton.click();
}

canvas.addEventListener("click", (event) => {
  const box = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - box.left) * canvas.width / box.width);
  const y = Math.floor((event.clientY - box.top) * canvas.height / box.height);
  playPixel(x, y);
});

canvas.addEventListener("keydown", (event) => {
  const dx = Math.max(1, Math.round(canvas.width / 50));
  const dy = Math.max(1, Math.round(canvas.height / 50));
  const moves = {
    ArrowLeft: [-dx, 0], ArrowRight: [dx, 0],
    ArrowUp: [0, -dy], ArrowDown: [0, dy], Enter: [0, 0]
  };

  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  playPixel(sampleX + move[0], sampleY + move[1]);
});
