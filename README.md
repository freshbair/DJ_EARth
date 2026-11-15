# DJ_EARth — Earth temperature & night lights to sound

A local, buildless planetary sonification studio: turn Earth temperature variation and NASA night lights into musical notes. Plain HTML, CSS, JavaScript, and the Web Audio API; no backend, downloads, API keys, or external dependencies.

## Tracks

### Track 2: Earth Temperature (Temperature variation → Earth bass)
- **Principle**: The higher the temperature, the higher the pitch.
  - Freezing/Cold (Navy / Blue, T = 0..1) → **Do / Ré** (C2 / D2: 65.4 / 73.4 Hz)
  - Temperate/Mild (Cyan / Green, T = 2..3) → **Mi / Fa** (E2 / F2: 82.4 / 87.3 Hz)
  - Warm/Hot/Scorching (Yellow / Red / Maroon, T = 4..6) → **Sol / La / Si** (G2 / A2 / B2: 98.0 / 110.0 / 123.5 Hz)
- **Bass Sound Synthesis**:
  - **Plucked Electric / Synth Bass**: Multilayer Web Audio architecture with resonant lowpass filter sweep ($Q = 3.6$), warm sine sub-bass, harmonic sawtooth body with string-snap transient, and mid-frequency presence.
  - **Bass Registers**: Deep Bass (C2–C3 · 65–131 Hz, authentic 4-string bass guitar range) and Tenor Bass (C3–C4 · 131–262 Hz).
- **Built-in Presets**:
  - **Earth thermal map** (`earth-temperature.jpg`): samples 8 geographic regions across the globe (Pacific Ocean, Amazon/South America, Atlantic Ocean, Central Africa, Indian Ocean, Southeast Asia, Western Pacific).
  - **Temperature test pattern**: 8 thermal color bands (Navy, Blue, Cyan, Green, Yellow, Red, Maroon, Navy) playing **Do → Ré → Mi → Fa → Sol → La Si → High Do**.
- **Interactive sampling**: Click anywhere on the map to sample the local temperature and preview its bass note.

### Track 1: Night Lights (Brightness → piano)
- Sample NASA night-lights imagery and map brightness `0..255` to piano notes **Do → Ré → Mi → Fa → Sol → La → Si** (C4–B4).
- 8 scan spots from left to right along the center row.
- Built-in grayscale test pattern ending on High Do (C5).

## Launch

Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, or Safari). From VS Code, reveal the file in Explorer and open it in your browser. Audio starts only after you press **Play scan** or preview a spot.

## Listening test

1. Select **Earth Temperature** (active by default).
2. Press **Play scan**. It scans across the 8 planetary locations at 0.5-second intervals playing the rich plucked Earth bass notes.
3. Switch between **Deep Bass (C2–C3)** and **Tenor Bass (C3–C4)** in the Bass Register controls to hear the octave difference.
4. Select **Use test pattern** and press **Play scan** to verify the full diatonic bass scale: **Do → Ré → Mi → Fa → Sol → La → Si → High Do**.
5. Click anywhere on the globe (e.g. Antarctica for sub-bass Do, Sahara/tropics for scorching Si) to hear that exact point.
6. Switch to **Night Lights** tab anytime to return to the brightness → piano track.
7. Adjust **Amplitude / volume** to change loudness independently of pitch.

## Mathematical & scientific mapping

- **Thermal Colormap Projection**:
  Piecewise projection onto the standard scientific rainbow / thermal colormap spline connecting 13 reference keys from Navy (0.0) through Blue (1.0), Cyan (2.0), Green (3.0), Yellow (4.0), Red (5.0), to Maroon (6.0).
- **Fixed scale**:
  Clamps and rounds temperature `0.0..6.0` to the 7 diatonic notes (Do, Ré, Mi, Fa, Sol, La, Si). Higher temperature strictly produces a higher pitch.
- **Learn from image**:
  Deterministic 1D k-means clustering learns up to 7 distinct temperature or brightness groups across the 2D pixel grid.
- **Background & rests**:
  Fully transparent pixels and off-map white background pixels outside the projected planetary globe are detected as rests.

## Checks

Open `tests.html` or click **Run the automated checks** in the app. It runs automated, repeatable tests covering:
- Scientific color-to-temperature projection (Navy to Maroon)
- Monotonic pitch progression (higher temperature = higher pitch)
- Test pattern octave ending on High Do
- Uploaded map fidelity (no unexpected transpositions)
- Grayscale / infrared linear temperature fallback
- Transparent and off-map background rest detection
- Deterministic 1D k-means clustering
- Earth bass and piano Web Audio synthesis, partials, and volume muting

## Code layout

- `index.html` / `style.css`: track navigation, responsive canvas stage, route cards, readouts.
- `temperature-track.js`: pure temperature mapping, thermal colormap projection, clustering.
- `light-track.js`: pure brightness mapping and clustering.
- `bass.js`: browser-synthesized Earth bass synthesizer voice.
- `piano.js`: browser-synthesized piano voice.
- `script.js`: app controller, track switching, presets, and overlays.
- `earth-temperature.jpg`: Earth temperature variation map.
- `tests.html` / `tests.js`: automated unit test suite.
