const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, Notification } = require('electron');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const REFRESH_MS = 60_000;
const DEFAULT_SIZE = { width: 420, height: 500 };
const APP_USER_MODEL_ID = 'com.codex.limitmonitor';
const APP_ICON = path.join(__dirname, 'build', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'build', 'icon-32.png');

let win;
let tray;
let refreshTimer;
let config;
const clients = new Map();
const runtime = new Map();
const resetTimers = new Map();

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function profilePath(id) {
  return path.join(app.getPath('userData'), 'profiles', id);
}

function defaultConfig() {
  return {
    version: 1,
    compact: false,
    notifications: true,
    notifiedResets: {},
    bounds: null,
    workspaces: [
      { id: 'workspace-1', name: 'Workspace 1', auth: 'default' },
      { id: 'workspace-2', name: 'Workspace 2', auth: 'isolated' }
    ]
  };
}

function loadConfig() {
  try {
    const loaded = { ...defaultConfig(), ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) };
    delete loaded.clickThrough;
    loaded.notifications = loaded.notifications !== false;
    loaded.notifiedResets = loaded.notifiedResets || {};
    return loaded;
  } catch {
    return defaultConfig();
  }
}

function saveConfig() {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  pruneNotifiedResets();
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

function resolveCodex() {
  if (process.env.CODEX_EXECUTABLE && fs.existsSync(process.env.CODEX_EXECUTABLE)) {
    return process.env.CODEX_EXECUTABLE;
  }
  try {
    const result = execFileSync('where.exe', ['codex'], { encoding: 'utf8', windowsHide: true });
    return result.split(/\r?\n/).find(Boolean).trim();
  } catch {
    return 'codex';
  }
}

class CodexClient {
  constructor(workspace) {
    this.workspace = workspace;
    this.proc = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = null;
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (this.workspace.auth === 'isolated') {
        env.CODEX_HOME = profilePath(this.workspace.id);
        fs.mkdirSync(env.CODEX_HOME, { recursive: true });
      }

      this.proc = spawn(resolveCodex(), ['app-server', '--stdio'], {
        env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.proc.once('error', (error) => {
        this.ready = null;
        reject(error);
      });

      this.proc.once('exit', (code) => {
        const error = new Error(`Codex App Server s-a oprit (cod ${code ?? 'necunoscut'}).`);
        for (const { reject: rejectPending } of this.pending.values()) rejectPending(error);
        this.pending.clear();
        this.proc = null;
        this.ready = null;
        setRuntime(this.workspace.id, { status: 'error', error: error.message });
      });

      const lines = readline.createInterface({ input: this.proc.stdout });
      lines.on('line', (line) => this.onLine(line));

      this.request('initialize', {
        clientInfo: { name: 'codex-limit-monitor', title: 'Codex Limit Monitor', version: app.getVersion() },
        capabilities: { experimentalApi: true, requestAttestation: false }
      }).then(() => {
        this.notify('initialized');
        resolve();
      }).catch(reject);
    });
    return this.ready;
  }

  onLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }

    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || 'Eroare Codex App Server'));
      else pending.resolve(message.result);
      return;
    }

    if (message.method === 'account/rateLimits/updated') {
      const current = runtime.get(this.workspace.id) || {};
      setRuntime(this.workspace.id, mergeRateLimitUpdate(current, message.params?.rateLimits));
    }

    if (message.method === 'account/login/completed') {
      if (message.params?.success) this.refresh();
      else setRuntime(this.workspace.id, { status: 'error', error: message.params?.error || 'Autentificarea a esuat.' });
    }
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.proc?.stdin?.writable) return reject(new Error('Codex App Server nu este disponibil.'));
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(`${JSON.stringify({ method, id, ...(params !== undefined ? { params } : {}) })}\n`);
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`Cererea ${method} a expirat.`));
      }, 20_000).unref();
    });
  }

  notify(method, params) {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(`${JSON.stringify({ method, ...(params !== undefined ? { params } : {}) })}\n`);
    }
  }

  async refresh() {
    setRuntime(this.workspace.id, { ...(runtime.get(this.workspace.id) || {}), status: 'loading', error: null });
    try {
      await this.start();
      const [accountRead, limitsRead, usageRead] = await Promise.allSettled([
        this.request('account/read', { refreshToken: false }),
        this.request('account/rateLimits/read'),
        this.request('account/usage/read')
      ]);
      if (accountRead.status === 'rejected') throw accountRead.reason;
      if (limitsRead.status === 'rejected') throw limitsRead.reason;
      const accountResult = accountRead.value;
      const limitsResult = limitsRead.value;
      const account = accountResult?.account || null;
      setRuntime(this.workspace.id, {
        status: account ? 'connected' : 'disconnected',
        account,
        rateLimits: limitsResult?.rateLimits || null,
        rateLimitsByLimitId: limitsResult?.rateLimitsByLimitId || null,
        resetCredits: limitsResult?.rateLimitResetCredits || null,
        usage: usageRead.status === 'fulfilled' ? usageRead.value : null,
        updatedAt: Date.now(),
        error: null
      });
    } catch (error) {
      setRuntime(this.workspace.id, { status: 'error', error: friendlyError(error), updatedAt: Date.now() });
    }
  }

  async login() {
    await this.start();
    const result = await this.request('account/login/start', {
      type: 'chatgpt',
      codexStreamlinedLogin: true,
      useHostedLoginSuccessPage: true,
      appBrand: null
    });
    if (!result?.authUrl) throw new Error('Codex nu a returnat linkul de autentificare.');
    await shell.openExternal(result.authUrl);
    setRuntime(this.workspace.id, { ...(runtime.get(this.workspace.id) || {}), status: 'authenticating', error: null });
  }

  async logout() {
    await this.start();
    await this.request('account/logout');
    setRuntime(this.workspace.id, { status: 'disconnected', account: null, rateLimits: null, rateLimitsByLimitId: null, resetCredits: null, usage: null, updatedAt: Date.now() });
    clearResetTimers(this.workspace.id);
  }

  stop() {
    if (this.proc && !this.proc.killed) this.proc.kill();
    this.proc = null;
    this.ready = null;
  }
}

function friendlyError(error) {
  const message = error?.message || String(error);
  if (/not logged in|authentication|unauthorized|401/i.test(message)) return 'Workspace neconectat. Apasa Conecteaza.';
  if (/ENOENT/i.test(message)) return 'Nu am gasit executabilul Codex in PATH.';
  return message;
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeSparse(base, patch) {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = isPlainObject(value) ? mergeSparse(base?.[key], value) : value;
  }
  return merged;
}

function mergeRateLimitUpdate(current, incoming) {
  if (!incoming) return { ...current, updatedAt: Date.now() };

  const previousSingle = current.rateLimits || null;
  const rateLimits = mergeSparse(previousSingle, incoming);
  const rateLimitsByLimitId = { ...(current.rateLimitsByLimitId || {}) };
  const limitId = incoming.limitId || rateLimits?.limitId || 'codex';

  if (limitId) {
    rateLimitsByLimitId[limitId] = mergeSparse(rateLimitsByLimitId[limitId] || previousSingle || {}, incoming);
  }

  return {
    ...current,
    status: current.account ? 'connected' : current.status,
    rateLimits,
    rateLimitsByLimitId: Object.keys(rateLimitsByLimitId).length ? rateLimitsByLimitId : null,
    updatedAt: Date.now(),
    error: null
  };
}

function limitWindowLabel(window, index) {
  const mins = window?.windowDurationMins;
  if (mins === 300) return 'limita de 5 ore';
  if (mins === 10080) return 'limita saptamanala';
  if (mins && mins < 60) return `limita de ${mins} min`;
  if (mins && mins % 1440 === 0) return `limita de ${mins / 1440} zile`;
  if (mins && mins % 60 === 0) return `limita de ${mins / 60} ore`;
  return index === 0 ? 'limita scurta' : 'limita lunga';
}

function allLimitSnapshots(value) {
  const byId = value?.rateLimitsByLimitId;
  if (byId && Object.keys(byId).length) return Object.values(byId).filter(Boolean);
  return value?.rateLimits ? [value.rateLimits] : [];
}

function resetKey(workspaceId, snapshot, window, index) {
  return [workspaceId, snapshot.limitId || 'codex', index, window.windowDurationMins || 'unknown', window.resetsAt].join(':');
}

function clearResetTimers(workspaceId) {
  for (const [key, timer] of resetTimers.entries()) {
    if (key.startsWith(`${workspaceId}:`)) {
      clearTimeout(timer);
      resetTimers.delete(key);
    }
  }
}

function scheduleResetNotifications(workspaceId, value) {
  if (!config?.notifications) return;
  const workspace = config.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || !Notification.isSupported()) return;

  const scheduled = new Set();
  for (const snapshot of allLimitSnapshots(value)) {
    [snapshot.primary, snapshot.secondary].filter(Boolean).forEach((window, index) => {
      if (!window.resetsAt) return;
      const key = resetKey(workspaceId, snapshot, window, index);
      scheduled.add(key);
      if (resetTimers.has(key) || config.notifiedResets?.[key]) return;

      const delay = (window.resetsAt * 1000) - Date.now();
      if (delay <= 1_000 || delay > 2_147_483_647) return;

      const timer = setTimeout(() => {
        resetTimers.delete(key);
        config.notifiedResets = { ...(config.notifiedResets || {}), [key]: Date.now() };
        saveConfig();
        showResetNotification(workspace, limitWindowLabel(window, index));
        getClient(workspaceId).refresh();
      }, delay);
      resetTimers.set(key, timer);
    });
  }

  for (const [key, timer] of resetTimers.entries()) {
    if (key.startsWith(`${workspaceId}:`) && !scheduled.has(key)) {
      clearTimeout(timer);
      resetTimers.delete(key);
    }
  }
}

function showResetNotification(workspace, label) {
  const notification = new Notification({
    title: 'Limita Codex s-a resetat',
    body: `${workspace.name}: ${label} este disponibila din nou.`,
    icon: APP_ICON,
    silent: false
  });
  notification.on('click', () => {
    if (!win || win.isDestroyed()) return;
    win.showInactive();
    win.setAlwaysOnTop(true, 'floating');
  });
  notification.show();
}

function pruneNotifiedResets() {
  const cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
  const entries = Object.entries(config.notifiedResets || {}).filter(([, notifiedAt]) => notifiedAt >= cutoff);
  config.notifiedResets = Object.fromEntries(entries);
}

function getClient(workspaceId) {
  const workspace = config.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error('Workspace inexistent.');
  if (!clients.has(workspaceId)) clients.set(workspaceId, new CodexClient(workspace));
  return clients.get(workspaceId);
}

function publicState() {
  return {
    compact: config.compact,
    workspaces: config.workspaces.map((workspace) => ({
      ...workspace,
      ...(runtime.get(workspace.id) || { status: 'loading' })
    }))
  };
}

function broadcastState() {
  if (win && !win.isDestroyed()) win.webContents.send('monitor:state', publicState());
  updateTrayMenu();
}

function setRuntime(id, value) {
  runtime.set(id, value);
  scheduleResetNotifications(id, value);
  broadcastState();
}

async function refreshAll() {
  await Promise.allSettled(config.workspaces.map((workspace) => getClient(workspace.id).refresh()));
  return publicState();
}

function createWindow() {
  const saved = config.bounds;
  const displayBounds = saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : {};
  win = new BrowserWindow({
    ...DEFAULT_SIZE,
    ...displayBounds,
    minWidth: 360,
    minHeight: 190,
    maxWidth: 520,
    frame: false,
    transparent: true,
    resizable: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(false);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('move', persistBounds);
  win.on('resize', persistBounds);
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

let boundsSaveTimer;
function persistBounds() {
  clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    if (!win?.isDestroyed()) {
      config.bounds = win.getBounds();
      saveConfig();
    }
  }, 250);
}

function trayIcon() {
  return nativeImage.createFromPath(TRAY_ICON).resize({ width: 16, height: 16 });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Codex Limit Monitor');
  tray.on('click', () => {
    if (win.isVisible()) win.hide();
    else { win.showInactive(); win.setAlwaysOnTop(true, 'floating'); }
  });
  updateTrayMenu();
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: win?.isVisible() ? 'Ascunde overlay' : 'Arata overlay', click: () => win.isVisible() ? win.hide() : win.showInactive() },
    { label: 'Actualizeaza acum', click: refreshAll },
    {
      label: 'Notificari la reset',
      type: 'checkbox',
      checked: Boolean(config?.notifications),
      click: (item) => {
        config.notifications = item.checked;
        saveConfig();
        if (item.checked) refreshAll();
        else {
          resetTimers.forEach((timer) => clearTimeout(timer));
          resetTimers.clear();
        }
      }
    },
    { type: 'separator' },
    { label: 'Inchide', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

function registerIpc() {
  ipcMain.handle('monitor:get-state', () => publicState());
  ipcMain.handle('monitor:refresh', () => refreshAll());
  ipcMain.handle('monitor:login', async (_event, id) => { await getClient(id).login(); return publicState(); });
  ipcMain.handle('monitor:logout', async (_event, id) => { await getClient(id).logout(); return publicState(); });
  ipcMain.handle('monitor:rename', (_event, { workspaceId, name }) => {
    const workspace = config.workspaces.find((item) => item.id === workspaceId);
    if (workspace && String(name).trim()) workspace.name = String(name).trim().slice(0, 40);
    saveConfig(); broadcastState(); return publicState();
  });
  ipcMain.handle('monitor:add-workspace', () => {
    const id = `workspace-${Date.now()}`;
    config.workspaces.push({ id, name: `Workspace ${config.workspaces.length + 1}`, auth: 'isolated' });
    saveConfig(); getClient(id).refresh(); broadcastState(); return publicState();
  });
  ipcMain.handle('monitor:remove-workspace', (_event, id) => {
    if (config.workspaces.length <= 1) return publicState();
    clients.get(id)?.stop(); clients.delete(id); runtime.delete(id);
    clearResetTimers(id);
    config.workspaces = config.workspaces.filter((item) => item.id !== id);
    saveConfig(); broadcastState(); return publicState();
  });
  ipcMain.handle('monitor:set-compact', (_event, compact) => {
    config.compact = Boolean(compact); saveConfig(); broadcastState(); return publicState();
  });
  ipcMain.handle('monitor:minimize', () => {
    if (win && !win.isDestroyed()) win.hide();
    return publicState();
  });
  ipcMain.handle('monitor:quit', () => { app.isQuitting = true; app.quit(); });
}

app.whenReady().then(() => {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  config = loadConfig();
  registerIpc();
  createWindow();
  createTray();
  refreshAll();
  refreshTimer = setInterval(refreshAll, REFRESH_MS);
});

app.on('before-quit', () => {
  app.isQuitting = true;
  clearInterval(refreshTimer);
  resetTimers.forEach((timer) => clearTimeout(timer));
  resetTimers.clear();
  for (const client of clients.values()) client.stop();
});

app.on('window-all-closed', (event) => event.preventDefault());
