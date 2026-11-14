const scale = [
    { name: 'Do', frequency: 261.63 },
    { name: 'Ré', frequency: 293.66 },
    { name: 'Mi', frequency: 329.63 },
    { name: 'Sol', frequency: 392 },
    { name: 'La', frequency: 440 }
];
const decks = [
    { year: 2012, values: [10, 30, 50], muted: false },
    { year: 2023, values: [10, 70, 50], muted: false }
];
const positions = [[23, 62], [50, 39], [78, 56]];
const noteFor = value => scale[Math.min(4, Math.floor(value / 20))];
const container = document.querySelector('#decks');
decks.forEach((deck, d) => {
    const article = document.createElement('article');
    article.className = 'deck';
    article.innerHTML = `<header><div><p>DECK ${d === 0 ? 'A' : 'B'} · NIGHT LIGHTS</p><h2>${deck.year}</h2></div><button class="mute" aria-pressed="false" aria-label="Mute ${deck.year} deck">Mute</button></header>
        <div class="map" aria-label="Illustrative three-stop route for ${deck.year}">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 26L19 18 34 24 38 37 28 46 31 63 23 81 17 66 19 45 10 39Z M49 20L64 16 86 28 91 43 77 47 72 63 59 70 54 53 44 41Z"/><polyline points="23,62 50,39 78,56"/></svg>
        ${positions.map(([x,y], s) => `<button class="point" style="left:${x}%;top:${y}%" data-stop="${s}" aria-label="Play ${deck.year}, stop ${s+1}, ${noteFor(deck.values[s]).name}">${s+1}</button>`).join('')}</div>
        <div class="notes">${deck.values.map((value,s) => `<div class="note" data-note="${s}"><small>STOP ${s+1}</small><strong>${noteFor(value).name}</strong><small>Brightness ${value}/100</small></div>`).join('')}</div>`;
    container.append(article);
    deck.element = article;
    article.querySelector('.mute').addEventListener('click', event => {
        deck.muted = !deck.muted;
        event.currentTarget.setAttribute('aria-pressed', String(deck.muted));
        event.currentTarget.textContent = deck.muted ? 'Unmute' : 'Mute';
        event.currentTarget.setAttribute('aria-label', `${deck.muted ? 'Unmute' : 'Mute'} ${deck.year} deck`);
        voices.filter(voice => voice.deck === deck).forEach(voice => voice.gain.gain.setTargetAtTime(0, audio.currentTime, 0.015));
    });
    article.querySelectorAll('.point').forEach(point => point.addEventListener('click', async () => {
        stop();
        try {
            await readyAudio();
            const s = Number(point.dataset.stop);
            highlight(s, d);
            sound(deck, s, audio.currentTime);
            status.textContent = `${deck.year} · Stop ${s+1}: ${noteFor(deck.values[s]).name}${deck.muted ? ' (deck muted)' : ''}.`;
        } catch { status.textContent = 'Audio could not start. Try again in a browser that supports Web Audio.'; }
    }));
});
let audio;
let voices = [];
let timer;
let generation = 0;
const play = document.querySelector('#play');
const stopButton = document.querySelector('#stop');
const tempo = document.querySelector('#tempo');
const status = document.querySelector('#status');
async function readyAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state !== 'running') await audio.resume();
}
function highlight(s, onlyDeck = null) {
    decks.forEach((deck,d) => {
        deck.element.querySelectorAll('.point, .note').forEach(element => {
            element.classList.toggle('active', (onlyDeck === null || onlyDeck === d) && Number(element.dataset.stop ?? element.dataset.note) === s);
        });
    });
}
function sound(deck, s, time) {
    if (deck.muted) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const pan = audio.createStereoPanner();
    pan.pan.value = deck === decks[0] ? -0.45 : 0.45;
    oscillator.type = 'sine';
    oscillator.frequency.value = noteFor(deck.values[s]).frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.48);
    oscillator.connect(gain).connect(pan).connect(audio.destination);
    const voice = { oscillator, gain, deck };
    voices.push(voice);
    oscillator.onended = () => { voices = voices.filter(v => v !== voice); oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
    oscillator.start(time);
    oscillator.stop(time + 0.5);
}
function stop() {
    generation++;
    clearTimeout(timer);
    voices.forEach(voice => { try { voice.oscillator.stop(); } catch {} });
    highlight(-1);
    play.disabled = false;
    stopButton.disabled = true;
    tempo.disabled = false;
    status.textContent = 'Ready. Press Play, or tap any location to hear its note.';
}
play.addEventListener('click', async () => {
    stop();
    const run = generation;
    play.disabled = true;
    stopButton.disabled = false;
    tempo.disabled = true;
    try {
        await readyAudio();
        if (run !== generation) return;
        const beat = 60000 / Number(tempo.value);
        let s = 0;
        function step() {
            if (run !== generation) return;
            if (s === 3) { stop(); status.textContent = 'Route complete. The second stop changed from Ré to Sol. Play again or tap a location.'; return; }
            highlight(s);
            const time = audio.currentTime + 0.01;
            decks.forEach(deck => sound(deck, s, time));
            status.textContent = `Stop ${s+1} of 3 · 2012: ${noteFor(decks[0].values[s]).name} · 2023: ${noteFor(decks[1].values[s]).name}`;
            s++;
            timer = setTimeout(step, beat);
        }
        step();
    } catch { stop(); status.textContent = 'Audio could not start. Try again in a browser that supports Web Audio.'; }
});
stopButton.addEventListener('click', stop);
tempo.addEventListener('input', () => { document.querySelector('#bpm').textContent = `${tempo.value} BPM`; });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
