const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codexMonitor', {
  getState: () => ipcRenderer.invoke('monitor:get-state'),
  refresh: () => ipcRenderer.invoke('monitor:refresh'),
  login: (workspaceId) => ipcRenderer.invoke('monitor:login', workspaceId),
  logout: (workspaceId) => ipcRenderer.invoke('monitor:logout', workspaceId),
  rename: (workspaceId, name) => ipcRenderer.invoke('monitor:rename', { workspaceId, name }),
  addWorkspace: () => ipcRenderer.invoke('monitor:add-workspace'),
  removeWorkspace: (workspaceId) => ipcRenderer.invoke('monitor:remove-workspace', workspaceId),
  setCompact: (compact) => ipcRenderer.invoke('monitor:set-compact', compact),
  minimize: () => ipcRenderer.invoke('monitor:minimize'),
  quit: () => ipcRenderer.invoke('monitor:quit'),
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('monitor:state', listener);
    return () => ipcRenderer.removeListener('monitor:state', listener);
  }
});
