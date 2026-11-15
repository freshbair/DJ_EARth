/* Presentation shortcuts reuse the studio's existing playback and track controls. */
(function () {
  'use strict';

  const shelf = document.querySelector('.track-nav');
  const tracks = [...document.querySelectorAll('.track-tab[data-track-index]')];
  const listen = document.querySelector('#listenEarth');
  const play = document.querySelector('#soloNote');
  const stop = document.querySelector('#soloStop');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let resizeFrame;

  function selectedTrack() {
    return tracks.find(track => track.getAttribute('aria-pressed') === 'true');
  }

  function centerSelected(animate = true) {
    const selected = selectedTrack();
    if (!shelf || !selected || window.innerWidth > 900 || shelf.scrollWidth <= shelf.clientWidth + 1) return;
    const shelfBounds = shelf.getBoundingClientRect();
    const trackBounds = selected.getBoundingClientRect();
    const left = shelf.scrollLeft + trackBounds.left - shelfBounds.left - (shelf.clientWidth - trackBounds.width) / 2;
    shelf.scrollTo({
      left: Math.max(0, Math.min(left, shelf.scrollWidth - shelf.clientWidth)),
      behavior: animate && !reduced?.matches ? 'smooth' : 'instant'
    });
  }

  function syncListenButton() {
    if (!listen || !play || !stop) return;
    const playing = play.getAttribute('aria-pressed') === 'true';
    const track = selectedTrack();
    const name = track?.querySelector('.track-tab-name')?.textContent.trim() || 'this track';
    const label = listen.querySelector('.listen-label');
    if (label) label.textContent = playing ? 'Stop listening' : 'Start listening';
    const icon = listen.querySelector('.listen-play');
    if (icon) icon.textContent = playing ? '\u25a0' : '\u25b6';
    listen.setAttribute('aria-pressed', String(playing));
    listen.setAttribute('aria-label', playing ? `Stop listening to ${name}` : `Start listening to ${name}`);
    listen.disabled = play.disabled;
  }

  if (listen && play && stop) {
    listen.addEventListener('click', () => {
      if (play.getAttribute('aria-pressed') === 'true') stop.click();
      else play.click();
      syncListenButton();
    });
    new MutationObserver(syncListenButton).observe(play, {
      attributes: true, attributeFilter: ['aria-pressed', 'disabled']
    });
  }

  tracks.forEach(track => track.addEventListener('click', () => {
    syncListenButton();
    centerSelected();
  }));
  if (shelf) {
    new MutationObserver(syncListenButton).observe(shelf, {
      subtree: true, attributes: true, attributeFilter: ['aria-pressed']
    });
    window.addEventListener('resize', () => {
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = undefined;
        centerSelected(false);
      });
    }, { passive: true });
    document.fonts?.ready.then(() => centerSelected(false));
  }
  window.addEventListener('pagehide', () => {
    if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame);
  });
  syncListenButton();
  centerSelected(false);
})();
