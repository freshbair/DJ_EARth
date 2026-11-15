# Reference playback restored

Live temperature API and embedded viewer removed. Speech alternatives and automatic reference-value intensity updates are retained.



# Hey DJ reference-data notes

`temperature-reference.js` embeds the **unchanged** repository `earth-temperature.jpg` as a data URL so canvas sampling works when index.html is opened via file://. It is an illustrated relative 0–6 scale, not a Celsius dataset, current weather feed, or labelled supervised weather-training set.

`countries.js` contains names, aliases and six deterministic sample points from the largest land polygon for 242 country/territory features. Source: [Natural Earth 1:50m Admin 0 countries](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/), downloaded from [the Natural Earth vector repository](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson). Natural Earth data is public domain. Names and boundaries follow that dataset; they are not a statement about disputed sovereignty. Small islands and territories may be absent or represented poorly at this scale.

Point generation: choose each feature's largest polygon by absolute shoelace area; sample an interior 19×19 grid over its bounding box, reject points outside its outer ring or inside holes, sort west to east, and choose six evenly spaced indices. This is **not** an area-weighted or population-weighted national average; offshore regions and other landmasses can be omitted. No coordinates are inferred from speech.

`country-temperature.js` uses a **hypothesized Robinson-style registration**, manually fitted to the illustration's visible map outline (x12..925, y4..443 in a 1024×484 image). Projection identity and geographic accuracy have not been independently validated. Border pixels, tiny countries and nearby seas can contaminate readings. A 3×3 median rejects very dark borders and white background but is only a heuristic. The resulting country melody is an approximate educational demonstration, not verified local temperature. This limitation is visible and spoken.

Seven or fewer k-means centres are learned from the bundled reference image using the existing temperature module. Country sample values select notes using those learned centres; no hardcoded country-to-melody table is used. A six-note harmonica phrase repeats until stopped; master volume is respected. Playback is reference-only even if the main studio currently displays an uploaded image.

## Browser interaction

On page load, the assistant queries microphone permission and automatically attempts wake-word listening only when the browser reports granted permission. Otherwise, the compact assistant offers Enable microphone; the site never grants itself permission or repeatedly requests denied access. Browser autoplay or speech-service policies may still require an interaction. Recognition may use a browser-provider server; the app does not implement its own audio upload or recording store. No claim of offline speech recognition is made. Wake listening is available only while the page is open and visible. Recognition pauses during speech output to avoid self-triggering. Country names are matched against known aliases; unknown and ambiguous names prompt for clarification instead of guessing.

The typed-country form works without microphone recognition. Controls are keyboard accessible, status messages use a polite live region, and the rapidly updating note display does not interrupt a screen reader every beat. Explicit Stop disables listening and playback. Manual track playback and track changes cancel the current conversation but retain an already enabled wake listener. Page hiding pauses everything; returning rechecks permission before restoring a previously enabled listener. The conversation is a compact, initially hidden nonmodal dialog opened by the wake phrase or its launcher. A future live-data adapter must replace the reference registration with explicit projection, time, units, masks and independently checked coordinates.

## Validation

`python ml/voice_browser_check.py` runs Chrome with mocked recognition and speech synthesis, real reference image decoding, real harmonica sample loading and country-note generation. It tests opt-in, the wake sequence, country lookup, unknown countries, permission denial, typed fallback, cancellation and layout at 390/768/1440 pixels. It does **not** establish microphone recognition accuracy, real speech timing, map registration accuracy or accessibility with blind participants. Those need hands-on testing.
