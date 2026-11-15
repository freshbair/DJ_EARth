/* Presentation-only pickers. Original track buttons and radios remain the source of truth. */
(function () {
  'use strict';

  const instances = [];
  const chevron = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function enhance(root, configuration) {
    if (!root || !configuration.items.length) return;
    const label = root.querySelector('.picker-label');
    if (label) label.id ||= `${root.id}-label`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${root.id}-trigger`;
    trigger.className = 'picker-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${root.id}-listbox`);
    const value = document.createElement('span');
    value.id = `${root.id}-value`;
    value.className = 'picker-value';
    trigger.setAttribute('aria-labelledby', [label?.id, value.id].filter(Boolean).join(' '));
    trigger.append(value);
    const arrow = document.createElement('span');
    arrow.className = 'picker-chevron';
    arrow.innerHTML = chevron;
    trigger.append(arrow);
    root.append(trigger);

    const popup = document.createElement('div');
    popup.id = `${root.id}-listbox`;
    popup.className = `picker-popup picker-popup-${root.dataset.picker}`;
    popup.setAttribute('role', 'listbox');
    popup.setAttribute('aria-label', configuration.label);
    popup.hidden = true;
    document.body.append(popup);
    let opened = false;
    let highlighted = 0;
    let search = '';
    let searchTime = 0;

    const options = configuration.items.map((item, index) => {
      const option = document.createElement('div');
      option.id = `${root.id}-option-${index}`;
      option.className = 'picker-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      if (root.dataset.picker === 'tracks') {
        const cover = document.createElement('span');
        cover.className = `picker-cover track-cover cover-${index}`;
        cover.setAttribute('aria-hidden', 'true');
        option.append(cover);
      }
      const copy = document.createElement('span');
      copy.className = 'picker-option-copy';
      const title = document.createElement('span');
      title.className = 'picker-option-title';
      title.textContent = item.label;
      copy.append(title);
      if (item.description) {
        const description = document.createElement('span');
        description.className = 'picker-option-description';
        description.textContent = item.description;
        copy.append(description);
      }
      const check = document.createElement('span');
      check.className = 'picker-check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18"><path d="m4.5 10 3.5 3.5 7.5-7.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      option.append(copy, check);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('pointermove', () => {
        if (!item.disabled()) highlight(index, false);
      });
      option.addEventListener('click', () => choose(index));
      popup.append(option);
      return option;
    });

    function selectedIndex() {
      return Math.max(0, configuration.items.findIndex(item => item.selected()));
    }

    function position() {
      if (!opened) return;
      const bounds = trigger.getBoundingClientRect();
      const width = Math.min(Math.max(bounds.width, root.dataset.picker === 'tracks' ? 284 : 230), window.innerWidth - 24);
      const left = Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12));
      const desiredHeight = Math.min(popup.scrollHeight + 2, 360);
      const below = window.innerHeight - bounds.bottom - 20;
      const above = bounds.top - 20;
      const useAbove = below < desiredHeight && above > below;
      const maxHeight = Math.max(44, Math.min(360, useAbove ? above : below));
      popup.style.width = `${width}px`;
      popup.style.maxHeight = `${maxHeight}px`;
      popup.style.left = `${left}px`;
      popup.style.top = useAbove
        ? `${Math.max(12, bounds.top - Math.min(desiredHeight, maxHeight) - 8)}px`
        : `${bounds.bottom + 8}px`;
      popup.dataset.placement = useAbove ? 'above' : 'below';
    }

    function highlight(index, scroll = true) {
      highlighted = index;
      options.forEach((option, at) => option.classList.toggle('is-highlighted', at === index));
      trigger.setAttribute('aria-activedescendant', options[index].id);
      if (scroll) options[index].scrollIntoView({ block: 'nearest' });
    }

    function close() {
      opened = false;
      popup.hidden = true;
      root.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      search = '';
    }

    function sync() {
      const selected = selectedIndex();
      value.textContent = configuration.items[selected].label;
      trigger.disabled = configuration.items.every(item => item.disabled());
      if (trigger.disabled) close();
      options.forEach((option, index) => {
        option.setAttribute('aria-selected', String(index === selected));
        option.setAttribute('aria-disabled', String(configuration.items[index].disabled()));
      });
      if (opened) position();
    }

    function open() {
      sync();
      if (trigger.disabled) return;
      instances.forEach(instance => instance.close());
      opened = true;
      popup.hidden = false;
      root.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      position();
      highlight(selectedIndex());
    }

    function choose(index) {
      if (configuration.items[index].disabled()) return;
      configuration.items[index].choose();
      sync();
      close();
      trigger.focus({ preventScroll: true });
    }

    function move(direction) {
      let next = highlighted;
      for (let attempts = 0; attempts < options.length; attempts++) {
        next = (next + direction + options.length) % options.length;
        if (!configuration.items[next].disabled()) {
          highlight(next);
          return;
        }
      }
    }

    trigger.addEventListener('click', () => opened ? close() : open());
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape' && opened) { event.preventDefault(); close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!opened) open();
        else move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!opened) open();
        const ordered = configuration.items.map((item, index) => ({ item, index }));
        if (event.key === 'End') ordered.reverse();
        const next = ordered.find(entry => !entry.item.disabled());
        if (next) highlight(next.index);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (opened) choose(highlighted);
        else open();
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (!opened) open();
        const now = performance.now();
        search = now - searchTime > 700 ? event.key : search + event.key;
        searchTime = now;
        const match = configuration.items.findIndex(item => !item.disabled() && item.label.toLowerCase().startsWith(search.toLowerCase()));
        if (match >= 0) {
          event.preventDefault();
          highlight(match);
        }
      }
    });
    trigger.addEventListener('blur', () => close());
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target) && !popup.contains(event.target)) close();
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', event => { if (!popup.contains(event.target)) position(); }, true);
    const instance = { sync, close };
    instances.push(instance);
    sync();
    root.classList.add('is-enhanced');
    configuration.onEnhanced?.();
  }

  const trackButtons = [...document.querySelectorAll('.track-tab[data-track-index]')];
  enhance(document.querySelector('#trackPicker'), {
    label: 'Choose an Earth track',
    items: trackButtons.map(button => ({
      label: button.querySelector('.track-tab-name')?.textContent.trim() || button.textContent.trim(),
      description: button.querySelector('.track-tab-desc')?.textContent.trim() || '',
      selected: () => button.getAttribute('aria-pressed') === 'true',
      disabled: () => button.disabled,
      choose: () => button.click()
    }))
  });
  const syncAll = () => instances.forEach(instance => instance.sync());
  const selectionObserver = new MutationObserver(syncAll);
  const navigation = document.querySelector('.track-nav');
  if (navigation) selectionObserver.observe(navigation, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'disabled'] });
  const status = document.querySelector('#status');
  if (status) selectionObserver.observe(status, { childList: true, subtree: true });
  document.addEventListener('change', syncAll);
  trackButtons.forEach(button => button.addEventListener('click', () => {
    instances.forEach(instance => instance.close());
    syncAll();
  }));

  function updateRange(input) {
    const minimum = input.min === '' ? 0 : Number(input.min);
    const maximum = input.max === '' ? 100 : Number(input.max);
    const progress = maximum > minimum ? (Number(input.value) - minimum) / (maximum - minimum) : 0;
    input.style.setProperty('--range-progress', `${Math.max(0, Math.min(1, progress)) * 100}%`);
  }
  document.querySelectorAll('input[type="range"]').forEach(updateRange);
  document.addEventListener('input', event => {
    if (event.target.matches('input[type="range"]')) updateRange(event.target);
  });
})();
