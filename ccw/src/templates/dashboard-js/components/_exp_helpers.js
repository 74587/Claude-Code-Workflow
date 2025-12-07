// Exploration helpers loaded

// Helper: Render exploration field with smart type detection
function renderExpField(label, value) {
  if (value === null || value === undefined) return '';
  let rendered;
  if (typeof value === 'string') {
    rendered = `<p>${escapeHtml(value)}</p>`;
  } else if (Array.isArray(value)) {
    rendered = renderExpArray(value);
  } else if (typeof value === 'object') {
    rendered = renderExpObject(value);
  } else {
    rendered = `<p>${escapeHtml(String(value))}</p>`;
  }
  return `<div class="exp-field"><label>${escapeHtml(label)}</label>${rendered}</div>`;
}

// Helper: Render array values
function renderExpArray(arr) {
  if (!arr.length) return '<p>-</p>';
  if (typeof arr[0] === 'object' && arr[0] !== null) {
    return `<div class="exp-array-objects">${arr.map(item => {
      if (item.question) {
        return `<div class="clarification-item">
          <div class="clarification-question">${escapeHtml(item.question)}</div>
          ${item.impact ? `<div class="clarification-impact">Impact: ${escapeHtml(item.impact)}</div>` : ''}
          ${item.priority ? `<span class="priority-badge priority-${item.priority}">${item.priority}</span>` : ''}
        </div>`;
      }
      return `<div class="exp-object-item">${renderExpObject(item)}</div>`;
    }).join('')}</div>`;
  }
  return `<ul class="exp-list">${arr.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`;
}

// Helper: Render object values recursively
function renderExpObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const entries = Object.entries(obj).filter(([k]) => !k.startsWith('_'));
  if (!entries.length) return '<p>-</p>';
  return `<div class="exp-object">${entries.map(([key, val]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') {
      return `<div class="exp-obj-field"><span class="exp-obj-key">${escapeHtml(label)}:</span> <span class="exp-obj-val">${escapeHtml(val)}</span></div>`;
    } else if (Array.isArray(val)) {
      return `<div class="exp-obj-field"><span class="exp-obj-key">${escapeHtml(label)}:</span>${renderExpArray(val)}</div>`;
    } else if (typeof val === 'object') {
      return `<div class="exp-obj-nested"><span class="exp-obj-key">${escapeHtml(label)}</span>${renderExpObject(val)}</div>`;
    }
    return `<div class="exp-obj-field"><span class="exp-obj-key">${escapeHtml(label)}:</span> <span class="exp-obj-val">${escapeHtml(String(val))}</span></div>`;
  }).join('')}</div>`;
}
