// ==========================================
// Conflict Resolution Tab
// ==========================================

async function loadAndRenderConflictTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading conflict resolution...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=conflict`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderConflictCards(data.conflictResolution);
        return;
      }
    }
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">⚖️</div>
        <div class="empty-title">No Conflict Resolution</div>
        <div class="empty-text">No conflict-resolution-decisions.json found for this session.</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load conflict resolution: ${err.message}</div>`;
  }
}

function renderConflictCards(conflictResolution) {
  if (!conflictResolution) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">⚖️</div>
        <div class="empty-title">No Conflict Resolution</div>
        <div class="empty-text">No conflict decisions found for this session.</div>
      </div>
    `;
  }

  let cards = [];

  // Header info
  cards.push(`
    <div class="conflict-tab-header">
      <h3>⚖️ Conflict Resolution Decisions</h3>
      <div class="conflict-meta-info">
        <span>Session: <strong>${escapeHtml(conflictResolution.session_id || 'N/A')}</strong></span>
        ${conflictResolution.resolved_at ? `<span>Resolved: <strong>${formatDate(conflictResolution.resolved_at)}</strong></span>` : ''}
      </div>
    </div>
  `);

  // User Decisions as cards
  if (conflictResolution.user_decisions && Object.keys(conflictResolution.user_decisions).length > 0) {
    const decisions = Object.entries(conflictResolution.user_decisions);

    cards.push(`<div class="conflict-section-title">🎯 User Decisions (${decisions.length})</div>`);
    cards.push('<div class="conflict-cards-grid">');

    for (const [key, decision] of decisions) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      cards.push(`
        <div class="conflict-card decision-card">
          <div class="conflict-card-header">
            <span class="conflict-card-label">${escapeHtml(label)}</span>
          </div>
          <div class="conflict-card-choice">
            <span class="choice-label">Choice:</span>
            <span class="choice-value">${escapeHtml(decision.choice || 'N/A')}</span>
          </div>
          ${decision.description ? `
            <div class="conflict-card-desc">${escapeHtml(decision.description)}</div>
          ` : ''}
          ${decision.implications && decision.implications.length > 0 ? `
            <div class="conflict-card-implications">
              <span class="impl-label">Implications:</span>
              <ul>
                ${decision.implications.map(impl => `<li>${escapeHtml(impl)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `);
    }
    cards.push('</div>');
  }

  // Resolved Conflicts as cards
  if (conflictResolution.resolved_conflicts && conflictResolution.resolved_conflicts.length > 0) {
    cards.push(`<div class="conflict-section-title">✅ Resolved Conflicts (${conflictResolution.resolved_conflicts.length})</div>`);
    cards.push('<div class="conflict-cards-grid">');

    for (const conflict of conflictResolution.resolved_conflicts) {
      cards.push(`
        <div class="conflict-card resolved-card">
          <div class="conflict-card-header">
            <span class="conflict-card-id">${escapeHtml(conflict.id || 'N/A')}</span>
            <span class="conflict-category-tag">${escapeHtml(conflict.category || 'General')}</span>
          </div>
          <div class="conflict-card-brief">${escapeHtml(conflict.brief || '')}</div>
          <div class="conflict-card-strategy">
            <span class="strategy-label">Strategy:</span>
            <span class="strategy-tag">${escapeHtml(conflict.strategy || 'N/A')}</span>
          </div>
        </div>
      `);
    }
    cards.push('</div>');
  }

  return `<div class="conflict-tab-content">${cards.join('')}</div>`;
}
