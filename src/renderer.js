const list = document.querySelector('#workspace-list');
const settingsPanel = document.querySelector('#settings-panel');
const workspaceSettings = document.querySelector('#workspace-settings');
const syncLabel = document.querySelector('#sync-label');
const planLabel = document.querySelector('#plan-label');
const refreshButton = document.querySelector('#refresh');
const compactButton = document.querySelector('#compact');
const settingsButton = document.querySelector('#settings');

let state = { workspaces: [], compact: false };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function resetLabel(timestamp) {
  if (!timestamp) return 'Asteapta date';
  return `Reset ${new Intl.DateTimeFormat('ro-RO', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp * 1000))}`;
}

function windowLabel(window, index) {
  const mins = window?.windowDurationMins;
  if (mins === 300) return '5 ore';
  if (mins === 10080) return 'Saptamana';
  if (mins && mins < 60) return `${mins} min`;
  if (mins && mins % 1440 === 0) return `${mins / 1440} zile`;
  if (mins && mins % 60 === 0) return `${mins / 60} ore`;
  return index === 0 ? 'Sesiune' : 'Termen lung';
}

function limitHtml(window, index) {
  if (!window) return '';
  const used = Math.max(0, Math.min(100, Number(window.usedPercent) || 0));
  const remaining = Math.max(0, 100 - used);
  const severity = remaining <= 10 ? 'danger' : remaining <= 30 ? 'warn' : '';
  return `<div class="limit-row">
    <div class="limit-meta"><strong>${windowLabel(window, index)}</strong><small>${Math.round(used)}% folosit · ${resetLabel(window.resetsAt)}</small></div>
    <progress class="track ${severity}" value="${remaining}" max="100" aria-label="${Math.round(remaining)}% ramas"></progress>
    <div class="percent">${Math.round(remaining)}%</div>
  </div>`;
}

function reachedLabel(type) {
  const labels = {
    workspace_owner_credits_depleted: 'Creditele workspace-ului sunt epuizate.',
    credits_depleted: 'Creditele workspace-ului sunt epuizate.',
    usage_limit: 'Limita de usage a fost atinsa.',
    rate_limit: 'Una dintre ferestrele de limita a fost atinsa.'
  };
  return labels[type] || `Limita atinsa: ${type}`;
}

function creditsText(credits) {
  if (!credits) return '';
  if (credits.unlimited) return 'Nelimitat';
  if (credits.hasCredits === false) return 'Epuizate';
  return escapeHtml(credits.balance ?? '-');
}

function formatTokens(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(Math.round(number));
}

function resetCreditsHtml(resetCredits) {
  if (!resetCredits || resetCredits.availableCount == null) return '';
  return `<div class="credit-line"><span>Reseturi disponibile</span><strong>${escapeHtml(resetCredits.availableCount)}</strong></div>`;
}

function usageHtml(usage) {
  const summary = usage?.summary || {};
  const buckets = Array.isArray(usage?.dailyUsageBuckets) ? usage.dailyUsageBuckets : [];
  const latest = buckets[buckets.length - 1];
  const rows = [];

  if (latest) rows.push(`<div class="credit-line"><span>Tokeni ${escapeHtml(latest.startDate)}</span><strong>${formatTokens(latest.tokens)}</strong></div>`);
  if (summary.lifetimeTokens != null) rows.push(`<div class="credit-line"><span>Tokeni total</span><strong>${formatTokens(summary.lifetimeTokens)}</strong></div>`);
  if (!rows.length) return '';
  return `<div class="usage-lines">${rows.join('')}</div>`;
}

function allSnapshots(workspace) {
  const byId = workspace.rateLimitsByLimitId;
  if (byId && Object.keys(byId).length) return Object.values(byId).filter(Boolean);
  return workspace.rateLimits ? [workspace.rateLimits] : [];
}

function workspaceHtml(workspace) {
  const status = workspace.status || 'loading';
  const identity = workspace.account?.email || workspace.account?.planType || '';
  const snapshots = allSnapshots(workspace);

  let body;
  if (status === 'loading') {
    body = `<div class="empty"><p>Se citesc limitele Codex...</p></div>`;
  } else if (status === 'authenticating') {
    body = `<div class="empty"><p>Finalizeaza autentificarea in browser.</p></div>`;
  } else if (!workspace.account || status === 'disconnected') {
    body = `<div class="empty"><p>Conecteaza acest profil la workspace-ul ChatGPT dorit.</p><button class="primary-button login" data-id="${escapeHtml(workspace.id)}">Conecteaza</button></div>`;
  } else if (!snapshots.length) {
    body = `<div class="empty"><p>Cont conectat, dar serviciul nu a furnizat inca limite.</p><button class="secondary-button refresh-one">Reincearca</button></div>`;
  } else {
    body = snapshots.map((snapshot) => {
      const title = snapshots.length > 1 ? `<div class="credit-line"><span>${escapeHtml(snapshot.limitName || snapshot.limitId || 'Codex')}</span><strong>${escapeHtml(snapshot.planType || '')}</strong></div>` : '';
      const reached = snapshot.rateLimitReachedType ? `<div class="alert-line">${escapeHtml(reachedLabel(snapshot.rateLimitReachedType))}</div>` : '';
      const windows = [snapshot.primary, snapshot.secondary].filter(Boolean).map(limitHtml).join('');
      const credits = snapshot.credits ? `<div class="credit-line"><span>Credite workspace</span><strong>${creditsText(snapshot.credits)}</strong></div>` : '';
      const spend = snapshot.individualLimit ? `<div class="credit-line"><span>Limita individuala</span><strong>${escapeHtml(snapshot.individualLimit.used)} / ${escapeHtml(snapshot.individualLimit.limit)}</strong></div>` : '';
      return `${title}${reached}<div class="limits">${windows}</div>${credits}${spend}`;
    }).join('') + resetCreditsHtml(workspace.resetCredits) + usageHtml(workspace.usage);
  }

  if (workspace.error && status === 'error') {
    body = `<div class="empty"><p>${escapeHtml(workspace.error)}</p><button class="primary-button login" data-id="${escapeHtml(workspace.id)}">Conecteaza</button></div>`;
  }

  return `<article class="workspace">
    <div class="workspace-head">
      <div class="workspace-title"><span class="status-dot ${escapeHtml(status)}"></span><h2>${escapeHtml(workspace.name)}</h2></div>
      <span class="identity">${escapeHtml(identity)}</span>
    </div>
    ${body}
  </article>`;
}

function renderSettings() {
  workspaceSettings.innerHTML = state.workspaces.map((workspace) => `
    <div class="workspace-setting">
      <div class="workspace-setting-main">
        <label>
          <span>Nume workspace</span>
          <input value="${escapeHtml(workspace.name)}" data-name="${escapeHtml(workspace.id)}" aria-label="Nume workspace">
        </label>
      </div>
      <div class="workspace-setting-actions">
        ${workspace.account ? `<button class="secondary-button logout" data-id="${escapeHtml(workspace.id)}">Deconecteaza</button>` : `<button class="secondary-button login" data-id="${escapeHtml(workspace.id)}">Conecteaza</button>`}
        <button class="danger-button remove" data-id="${escapeHtml(workspace.id)}" ${state.workspaces.length <= 1 ? 'disabled' : ''}>Sterge</button>
      </div>
    </div>`).join('');
}

function render(nextState) {
  state = nextState;
  document.body.classList.toggle('compact', state.compact);
  compactButton.textContent = state.compact ? '+' : '−';
  compactButton.title = state.compact ? 'Extinde' : 'Mod compact';
  compactButton.setAttribute('aria-label', compactButton.title);
  list.innerHTML = state.workspaces.map(workspaceHtml).join('');
  renderSettings();

  const connected = state.workspaces.filter((workspace) => workspace.status === 'connected').length;
  const newest = Math.max(0, ...state.workspaces.map((workspace) => workspace.updatedAt || 0));
  syncLabel.textContent = newest ? `Actualizat ${new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit' }).format(new Date(newest))}` : 'Se conecteaza...';
  planLabel.textContent = `${connected}/${state.workspaces.length} conectate`;
}

async function action(promise) {
  try { render(await promise); }
  catch (error) { syncLabel.textContent = error?.message || 'Actiunea a esuat'; }
}

document.addEventListener('click', (event) => {
  const login = event.target.closest('.login');
  const logout = event.target.closest('.logout');
  const remove = event.target.closest('.remove');
  if (login) action(window.codexMonitor.login(login.dataset.id));
  if (logout) action(window.codexMonitor.logout(logout.dataset.id));
  if (remove) action(window.codexMonitor.removeWorkspace(remove.dataset.id));
  if (event.target.closest('.refresh-one')) action(window.codexMonitor.refresh());
});

workspaceSettings.addEventListener('change', (event) => {
  if (event.target.matches('[data-name]')) action(window.codexMonitor.rename(event.target.dataset.name, event.target.value));
});

refreshButton.addEventListener('click', async () => {
  refreshButton.classList.add('spinning');
  await action(window.codexMonitor.refresh());
  refreshButton.classList.remove('spinning');
});
document.querySelector('#compact').addEventListener('click', () => action(window.codexMonitor.setCompact(!state.compact)));
document.querySelector('#minimize').addEventListener('click', () => action(window.codexMonitor.minimize()));
settingsButton.addEventListener('click', () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  document.body.classList.toggle('settings-open', !settingsPanel.hidden);
  settingsButton.classList.toggle('active', !settingsPanel.hidden);
  settingsButton.setAttribute('aria-expanded', String(!settingsPanel.hidden));
});
document.querySelector('#add-workspace').addEventListener('click', () => action(window.codexMonitor.addWorkspace()));
document.querySelector('#quit').addEventListener('click', () => window.codexMonitor.quit());

window.codexMonitor.onState(render);
window.codexMonitor.getState().then(render);
