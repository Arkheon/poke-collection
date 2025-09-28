// src/ui/iconSelect.js
// Lightweight custom dropdown that mirrors a native <select>,
// but renders an icon (set symbol) before each option label.

import { setSymbolFromSlug } from '../services/setsMeta.js';

function buildOptionNode(value, label) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'si-option';
  el.dataset.value = value;
  const icon = value && value !== 'all' ? setSymbolFromSlug(value) : '';
  el.innerHTML = `${icon ? `<img class="set-icon" src="${icon}" alt="" aria-hidden="true"/>` : ''}<span class="txt">${label}</span>`;
  return el;
}

export function enhanceSeriesSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Remove previous enhancement if any
  const prev = select.nextElementSibling;
  if (prev && prev.classList?.contains('si')) prev.remove();

  // Build wrapper
  const wrap = document.createElement('div');
  wrap.className = 'si'; // select-icon

  // Button showing current selection
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'si-button';

  // Panel with options
  const panel = document.createElement('div');
  panel.className = 'si-panel';
  panel.hidden = true;

  // Fill options from the native select
  const opts = Array.from(select.querySelectorAll('option'));
  function labelFor(v){
    const o = opts.find(x => x.value === v);
    return o ? o.textContent : '';
  }
  function iconFor(v){ return (v && v !== 'all') ? setSymbolFromSlug(v) : ''; }

  function renderButton(){
    const v = select.value || 'all';
    const icon = iconFor(v);
    btn.innerHTML = `${icon ? `<img class="set-icon" src="${icon}" alt="" aria-hidden="true"/>` : ''}<span class="txt">${labelFor(v)}</span>`;
  }

  opts.forEach(o => {
    const node = buildOptionNode(o.value, o.textContent);
    node.addEventListener('click', () => {
      select.value = o.value;
      renderButton();
      panel.hidden = true;
      // Propagate change to existing logic
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    panel.appendChild(node);
  });

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) panel.hidden = true;
  });

  renderButton();
  wrap.appendChild(btn);
  wrap.appendChild(panel);

  // Hide native select and insert the custom UI just after it
  select.style.display = 'none';
  select.insertAdjacentElement('afterend', wrap);
}

