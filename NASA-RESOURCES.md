# NASA resources for DJ_EARth

User-provided resource collection. These pages provide imagery, movies, and in some cases frame sets; listing a source here does not connect it to the audio engine.

| Resource | Potential project use | Notes |
| --- | --- | --- |
| [Earth Information Center](https://svs.gsfc.nasa.gov/gallery/earth-information-center/) | Browse Earth visualization sources | Collection covering multiple Earth topics. |
| [Caldwell 73 sonification](https://svs.gsfc.nasa.gov/13786/) | Sonification design reference | Star cluster, not an Earth parameter dataset. |
| [Night lights, 2012–2023](https://svs.gsfc.nasa.gov/5313/) | Nightlight / piano | Distinguish annual brightness imagery from the purple/orange change visualization. |
| [Sea surface currents and temperature](https://svs.gsfc.nasa.gov/3912/#media_group_349716) | Ocean currents / harp; sea surface temperature / harmonica | Color encodes temperature, not current speed. Sea surface temperature is distinct from air temperature. |
| [GEOS Aerosols (2025)](https://svs.gsfc.nasa.gov/5669/) | Air quality / flute | Modeled aerosols; not a direct AQI reading. |
| [Air Quality Model Runs](https://svs.gsfc.nasa.gov/5533/) | Air quality / flute | GEOS-CF pollutant visualizations. Select a pollutant and its scale before mapping values. |
| [Perpetual Ocean 2](https://svs.gsfc.nasa.gov/5425/) | Ocean currents / harp | Beauty version uses aesthetic colors; do not infer current speed from color. |
| [DYAMOND Global Carbon Dioxide](https://svs.gsfc.nasa.gov/5196/) | Optional future CO2 parameter | CO2 concentrations, not a direct AQI or wind speed measurement. |
| [ISS lightning events, 2017–2023](https://svs.gsfc.nasa.gov/5011/) | Storms / electric guitar | Lightning activity can be a storm proxy; it is not a direct storm intensity measurement. |
| [Atmospheric river in 3D](https://svs.gsfc.nasa.gov/4960/) | Atmospheric transport reference | Includes clouds and precipitation; establish a suitable quantitative wind source before mapping wind speed. |
| [GEDI Forest Height](https://svs.gsfc.nasa.gov/4950/) | Optional vegetation height / bass | Forest canopy height, not terrain altitude. Keep the requested altitude track until a terrain source is selected. |

## Track reference images

Tracks 3-8 now display local NASA stills from `assets/tracks/`. Use `python download-track-images.py` to refresh these assets.

- Air quality: SVS 5533.
- Storms: SVS 5011 (lightning activity).
- Ocean currents: SVS 3912 (colors encode temperature).
- Wind speed: SVS 4960 (atmospheric transport reference, not wind speed measurements).
- Hurricane: added [2021 Hurricane Season through September](https://svs.gsfc.nasa.gov/4947/).
- Altitude: added [Visualizing Elevation](https://svs.gsfc.nasa.gov/11734), credited to NASA/JPL/METI/ASTER Team; this uses terrain elevation rather than GEDI forest height.

These reference images are not connected to the audio engine. Tracks 3-8 retain explicitly labeled solo demo values. Quantitative layers and parameter-specific image decoding are still needed for measured-data playback.
