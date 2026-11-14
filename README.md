# DJ_EARth

A small, local brightness-to-sound test. Open `index.html` in a browser; no server or dependencies are required.

Move the brightness slider to update two sound parameters:

- **Pitch:** `220 + 660 × (brightness / 255)` Hz, from 220 to 880 Hz.
- **Relative amplitude:** `brightness / 255`, from 0% to 100%.

Press **Start sound** and move the slider to hear both changes live. Press **Stop sound** to stop. Zero brightness is silent. Audio also stops when the tab is hidden.

The output gain is capped at 0.15; the amplitude display is relative to this maximum. This is a chosen musical mapping from one input to two outputs, not a measurement of the frequency of light.
