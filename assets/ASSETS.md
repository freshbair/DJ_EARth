# Visual assets

- `earth-day.jpg`: Earth texture from the [three.js example assets](https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg). Used only for the decorative 3D globe, never for measurements or audio mapping.
- `fonts/space-grotesk.ttf`: [Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), SIL Open Font License. License retained in `fonts/OFL.txt`.
- `logo.png`: User-supplied team artwork.

All visual assets are served locally; the interface needs no remote font or globe-texture requests.

- `fonts/playfair/`: Playfair Display from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/playfairdisplay), SIL Open Font License retained beside font files.
- `sleeves/track-0.svg` through `track-7.svg`: original vector album artwork for the eight Earth/instrument themes.

- `fonts/caveat/`: Caveat handwriting font, SIL Open Font License retained beside font file. Instrument and score sketches are original SVG artwork.
# NO2 experiment sources

`no2/march-2015-2019.jpg` and `no2/march-2020.jpg` are unchanged copies of the NASA images supplied by the user. Source: [NASA Aura OMI comparison](https://airquality.gsfc.nasa.gov/slider/pandemic-and-after-northeast-us-2015-2019-versus-2020). `no2/model.js` is generated locally by `ml/train_no2.py`; source hashes and evaluation are recorded in `ml/no2-evaluation.json`.

## Global night lights

`tracks/night-lights.jpg`: NASA Black Marble 2016 global colour map, 3600 by 1800 pixels, downloaded unchanged from https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg . Source and background: https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/ . Sonification uses rendered pixel brightness, not calibrated radiance.

## Team-supplied reference maps

The six `tracks/reference-*` files were copied byte-for-byte from the user-provided `heat maps` folder. Filenames identify air quality, altitude, hurricane, night lights, ocean currents and wind. Original annotations and watermarks are retained. Dates and authors are not inferred from filenames. `night-lights-data.js` embeds the exact WebP bytes for local-file canvas access. The earlier NASA night-lights JPEG remains an unused archived asset.
