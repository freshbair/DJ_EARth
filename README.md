# DJ_EARth — light → piano

A local, buildless first track: sample NASA night-lights imagery and turn displayed brightness into piano notes. Plain HTML, CSS, JavaScript, and the Web Audio API; no backend, downloads, API key, or dependencies.

## Launch

Open `index.html` directly in a current browser (Chrome, Edge, Firefox, or Safari). From VS Code, you can reveal the file in Explorer and open it in your browser. An existing Live Server setup also works, but is not required. Audio starts only after you press **Play scan** or preview a location.

If the page still shows the older cards without C4/C5 pitch labels, hard-refresh with **Ctrl+Shift+R**. Spot 8 should visibly say **High Do**, **C5 · 523.3 Hz**; spot 1 should show **C4 · 261.6 Hz**. The script URLs are versioned to reload the updated sound mapping.

## First listening test

1. Leave **Fixed scale** selected. The built-in **Test pattern** has eight equal blocks: **0, 48, 88, 128, 168, 208, 255, 0**.
2. Press **Play scan**. It samples the segment centers on the middle row, left to right, at 0.5-second intervals.
3. Listen for **Do → Ré → Mi → Fa → Sol → La → Si → high Do**. The first Do is **C4 (261.6 Hz)** and the last is **C5 (523.3 Hz)**, exactly one octave higher. Both black blocks are valid notes. The final octave lift is an explicit musical ending for this built-in test phrase; uploaded images continue to follow brightness only.
4. Adjust **Amplitude / volume** and replay: loudness changes, the notes do not. At 0% every note is silent, but the visual scan still runs.
5. Press **Stop** midway. All sound and the active highlight stop. **Play scan** always restarts from spot 1. Clicking any numbered marker or note card previews that location and cancels a running scan.

Each synthesized note has a fast attack and a fading tail. Adjacent tails may overlap naturally, but there is only one scan timer. The final note is allowed to fade before the scan finishes. This is a synthesized piano-like tone, not a sampled acoustic piano.

## Upload and learned mode

Use **Upload NASA night-lights image** to select a local PNG or JPG. The image stays in your browser. Its original resolution is retained, and its eight scan samples and learned brightness groups are recomputed after each successful upload. **Use test pattern** restores the built-in strip. The existing `images day` folder was empty, so no external image assets are required.

- Brightness is `round(0.2126R + 0.7152G + 0.0722B)` for each sampled pixel.
- **Fixed scale** maps `floor(brightness × 7 / 256)` to Do, Ré, Mi, Fa, Sol, La, Si (C4, D4, E4, F4, G4, A4, B4).
- **Learn from image** uses deterministic one-dimensional k-means, with up to seven groups and at most 32,768 sampled pixels distributed across a 2D grid. Fully transparent pixels are excluded from training.
- Centers are shown in ascending brightness order. Each sample is assigned to its nearest center; equal-distance ties favor the darker group. With fewer than seven groups, notes are spread in order across Do–Si. A uniform image has one group and always plays Do in learned mode.
- Alpha zero means **Rest**. Opaque black is a valid note. Partially transparent pixels use their RGB values. If training finds no visible pixels, no centers are shown; any valid scan pixels fall back to the fixed scale.
- Volume is independent of brightness and pitch. It controls a capped master gain; 100% is the prototype's moderate maximum, not a brightness measurement.

The canvas is for display only. The active marker and scan line are separate DOM overlays, and measurement uses a separate RGBA grid. Highlights cannot change sampled brightness. Uploading, changing pitch mode, and hiding the tab cancel playback.

## Checks

Open `tests.html` or select **Run the automated checks** in the app. It runs 18 repeatable checks against the actual light and piano modules, including the high-Do phrase ending, unchanged uploaded-image mapping, sample positions, every fixed-scale brightness bin, RGB weights, black/transparent pixels, uniform and changing images, deterministic clustering, volume-independent pitch, mute/Stop, and the attack/decay envelope. Tests use a fake audio context and remain silent.

Controller integration was also checked with simulated DOM, image decoding, audio, and timers: 500 ms scan timing, exactly eight notes, restart without overlap, Stop including pending audio startup, unchanged source pixels, volume changes, uploaded-image replacement and retraining, failed-upload recovery, and transparent rests. A real-browser listening and visual check remains necessary; mocks cannot assess timbre or device audio output.

For a manual upload check, upload a uniformly gray image: learned mode should show one center and play Do at all eight locations. Replace it with a different gray image: the learned center and brightness readouts must change. A fully transparent PNG should show Rest at every location.

## Code layout

- `index.html` / `style.css`: accessible controls, source image, route, and model readout.
- `light-track.js`: pure light → note mapping, image-grid sampling, and brightness clustering.
- `piano.js`: piano-like synthesis, volume, and voice cleanup.
- `script.js`: image uploads, scan scheduling, overlays, and controls.
- `tests.html` / `tests.js`: local repeatable light/audio checks.

Temperature → bass and lightning → guitar can later be separate analysis/instrument layers. Only light → piano is implemented here. Image brightness is a musical input, not calibrated physical light intensity.
