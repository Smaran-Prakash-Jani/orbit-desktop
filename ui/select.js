'use strict';
// A shared, keyboard-accessible glass listbox, rendered in the browser's top layer.
window.OrbitSelect = (() => {
  const controls = new Map();
  function enhance(select) {
    const wrapper = document.createElement('span');
    wrapper.className = 'glass-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Choose an option');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.className = 'select-menu';
    list.id = `${select.id}-options`;
    list.setAttribute('popover', 'auto');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', trigger.getAttribute('aria-label'));
    trigger.setAttribute('aria-controls', list.id);
    let active = select.selectedIndex, search = '', searchTimer;
    const options = Array.from(select.options, (option, index) => {
      const row = document.createElement('div');
      row.id = `${select.id}-option-${index}`;
      row.className = 'select-option';
      row.setAttribute('role', 'option');
      row.textContent = option.textContent;
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('click', () => choose(index));
      list.append(row);
      return row;
    });
    function isOpen() { return list.matches(':popover-open'); }
    function sync() {
      trigger.textContent = select.selectedOptions[0]?.textContent || '';
      options.forEach((row, i) => row.setAttribute('aria-selected', String(i === select.selectedIndex)));
    }
    function highlight(index) {
      active = Math.max(0, Math.min(options.length - 1, index));
      options.forEach((row, i) => row.classList.toggle('highlighted', i === active));
      trigger.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({block:'nearest'});
    }
    function open() {
      if (isOpen()) return;
      list.showPopover();
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(innerWidth - 16, Math.max(rect.width, 170));
      list.style.width = `${width}px`;
      list.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
      const height = list.getBoundingClientRect().height;
      list.style.top = `${rect.bottom + height + 8 < innerHeight ? rect.bottom + 7 : Math.max(8, rect.top - height - 7)}px`;
      trigger.setAttribute('aria-expanded', 'true');
      highlight(select.selectedIndex);
    }
    function close() {
      if (isOpen()) list.hidePopover();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
    }
    function choose(index) {
      select.selectedIndex = index;
      sync();
      select.dispatchEvent(new Event('change', {bubbles:true}));
      close();
      trigger.focus();
    }
    trigger.addEventListener('click', () => isOpen() ? close() : open());
    trigger.addEventListener('keydown', event => {
      const key = event.key;
      if (key === 'Tab') { close(); return; }
      if (key === 'Escape') { if(isOpen()){event.preventDefault();event.stopPropagation();close();} return; }
      if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(key)) {
        event.preventDefault();
        if (!isOpen()) { open(); if(key === 'Home')highlight(0);if(key === 'End')highlight(options.length-1);return; }
        if (key === 'Enter' || key === ' ') choose(active);
        else highlight(key === 'Home' ? 0 : key === 'End' ? options.length - 1 : active + (key === 'ArrowDown' ? 1 : -1));
      } else if(key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();open();clearTimeout(searchTimer);search += key.toLowerCase();
        const match = options.findIndex(row => row.textContent.toLowerCase().startsWith(search));
        if(match >= 0) highlight(match);
        searchTimer = setTimeout(() => {search='';}, 600);
      }
    });
    list.addEventListener('toggle', () => { if(!isOpen()) close(); });
    select.addEventListener('change', sync);
    select.before(wrapper);
    wrapper.append(trigger, select);
    select.hidden = true;
    document.body.append(list);
    sync();
    controls.set(select, {sync, close});
  }
  window.addEventListener('resize', () => controls.forEach(control => control.close()));
  document.addEventListener('wheel', event => {if(!event.target.closest?.('.select-menu'))controls.forEach(control => control.close());}, {capture:true,passive:true});
  return {closeAll:()=>controls.forEach(control=>control.close()),enhanceAll:()=>document.querySelectorAll('select').forEach(select=>{if(!controls.has(select))enhance(select);}),syncAll:()=>controls.forEach(control=>control.sync())};
})();
