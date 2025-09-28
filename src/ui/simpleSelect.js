// src/ui/simpleSelect.js
// Generic custom dropdown UI (no icons). Mirrors a native <select> element.

export function enhanceSimpleSelect(selectId){
  const select = document.getElementById(selectId);
  if (!select) return;

  // Remove previous enhancement if any
  const prev = select.nextElementSibling;
  if (prev && prev.classList?.contains('si')) prev.remove();

  // Build wrapper
  const wrap = document.createElement('div');
  wrap.className = 'si';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'si-button';

  const panel = document.createElement('div');
  panel.className = 'si-panel';
  panel.hidden = true;

  const opts = Array.from(select.querySelectorAll('option'));

  function labelFor(v){
    const o = opts.find(x => x.value === v);
    return o ? o.textContent : '';
  }

  function renderButton(){
    const v = select.value || (opts[0]?.value ?? '');
    btn.innerHTML = `<span class="txt">${labelFor(v)}</span>`;
  }

  opts.forEach(o => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'si-option';
    el.dataset.value = o.value;
    el.innerHTML = `<span class="txt">${o.textContent}</span>`;
    el.addEventListener('click', () => {
      select.value = o.value;
      renderButton();
      panel.hidden = true;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    panel.appendChild(el);
  });

  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) panel.hidden = true; });

  renderButton();
  wrap.appendChild(btn);
  wrap.appendChild(panel);

  select.style.display = 'none';
  select.insertAdjacentElement('afterend', wrap);
}

