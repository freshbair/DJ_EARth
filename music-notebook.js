/* Decorative instrument sketches follow the selected track; audio remains untouched. */
(function () {
  'use strict';
  const drawing = document.querySelector('#instrumentSketch');
  const caption = document.querySelector('#instrumentCaption');
  const assignments = globalThis.DJEarthInstruments?.assignments;
  if (!drawing || !caption || !assignments) return;
  function sync() {
    const assignment = assignments[Number(document.body.dataset.track ?? 1)];
    if (!assignment) return;
    drawing.setAttribute('href', '#sketch-' + assignment.id);
    caption.textContent = 'the ' + assignment.instrument.toLowerCase();
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-track'] });
  sync();
})();
