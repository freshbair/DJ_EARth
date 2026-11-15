# First experiment: NO₂ map to sound

Open the site and select **Air quality**, then use **Listen to the air** below the existing studio controls. Choose a historical map, move the row/column sliders (keyboard supported), and press **Hear this point**. The existing track demos are unchanged. This experiment has its own upload because it requires a specific palette and template.

## What is learned

Supervised, uniform-weight 5-nearest-neighbor regression from RGB to NO₂ column values. The training set contains 156 labelled colours sampled every second pixel from the March 2015–2019 legend. Labels come from the published linear legend positions (x797 = 0, x1113 = 10); they are not ground measurements. No map pixel is assigned a fabricated weather label. A simple calibrated colour lookup would also be a reasonable baseline for this problem; a larger neural network is not justified by these two images.

`python ml/train_no2.py` rebuilds `assets/no2/model.js` and `ml/no2-evaluation.json`. Requires Python, NumPy and Pillow; runtime is plain browser JavaScript with no network model download. The exported training samples are the fitted k-NN model. Versioned source-image SHA-256 hashes are in the evaluation report.

Evaluation holds out the entire 2020 legend (311 colours). k=5 and the training stride are fixed, not tuned on the later image. The report compares legend reconstruction with a constant training-mean baseline. Adjacent legend pixels are correlated; this is not 311 independent weather observations and not an estimate of map-pixel or geographic accuracy. No independently labelled terrain pixels are available in the supplied JPEGs.

## Reading and sound

The browser rejects incompatible aspect ratios and checks six legend locations against the learned scale. This is only a palette sanity check: it cannot establish the image's actual date, geography, units or provenance. Uploads must use the supplied full northeast-US template and scale. A matching-looking unrelated image is not guaranteed to be rejected.

Each selected point uses a 5×5 patch. At least 15 pixels must pass the colour-distance, alpha, saturation, ocean and dark-pixel checks; a large value spread also rejects the patch. These are heuristic quality gates, not calibrated uncertainty estimates. Headers and legend areas are masked for this template. Unsupported/dark/background locations return null and silence, never zero. The dark-pixel rule also loses some genuinely high NO₂ values. Shaded terrain can still produce biased accepted estimates. No AQI or health categories are assigned.

Pitch is fixed: `523.2511306 * 2 ** (value / 5)` Hz, two octaves over 0–10. Master volume is independent. New maps do not refit clusters or change that scale. The sound-reference sequence demonstrates 0, 2.5, 5, 7.5 and 10. Stop, track switching and page hiding cancel pending playback. Text readouts, keyboard sliders and native buttons provide a nonvisual route; usability has not yet been tested with blind participants.

## Toward accurate temperature sonification

The user's target is to translate a newly supplied map, not forecast weather. Obtain the temperature product's legend, units (absolute temperature versus anomaly), no-data mask, date and projection. Prefer the original numerical raster/NetCDF/CSV to coloured screenshots: the conversion to sound can then use measured values directly. If screenshots are necessary, calibrate that specific palette and validate against independently labelled map locations on held-out dates. Do not reuse this NO₂ palette for temperature, rain or wind. The provided nightlights, storm photos, elevation and current visualizations do not supply temperature labels.

## Sources

- [NASA matched NO₂ maps and interpretation](https://airquality.gsfc.nasa.gov/slider/pandemic-and-after-northeast-us-2015-2019-versus-2020)
- [Nearest-neighbor regression definition](https://scikit-learn.org/stable/modules/neighbors.html#nearest-neighbors-regression)

The two source JPEGs were supplied by the user and copied unchanged. Existing model-independent site functionality remains intact.
