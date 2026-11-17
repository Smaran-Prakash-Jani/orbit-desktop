const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('orbit', Object.freeze({
  system: () => ipcRenderer.invoke('orbit:system'),
  snapshot: () => ipcRenderer.invoke('orbit:snapshot'),
  processes: () => ipcRenderer.invoke('orbit:processes'),
  health: () => ipcRenderer.invoke('orbit:health'),
  inspect: () => ipcRenderer.invoke('orbit:inspect'),
  cancelInspect: () => ipcRenderer.invoke('orbit:cancel-inspect'),
  reveal: () => ipcRenderer.invoke('orbit:reveal'),
  exportReport: () => ipcRenderer.invoke('orbit:export'),
  windowControl: action => ipcRenderer.invoke('orbit:window', action)
}));
