const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('MM', {
  // Window controls
  minimize:       () => ipcRenderer.invoke('window-minimize'),
  maximize:       () => ipcRenderer.invoke('window-maximize'),
  close:          () => ipcRenderer.invoke('window-close'),
  quit:           () => ipcRenderer.invoke('window-quit'),
  isMaximized:    () => ipcRenderer.invoke('window-is-maximized'),

  // First launch
  isFirstLaunch:  () => ipcRenderer.invoke('is-first-launch'),

  // API key
  getApiKey:      () => ipcRenderer.invoke('get-api-key'),
  setApiKey:  (key)  => ipcRenderer.invoke('set-api-key', key),

  // Repo URL
  getRepoUrl:     () => ipcRenderer.invoke('get-repo-url'),
  setRepoUrl: (url)  => ipcRenderer.invoke('set-repo-url', url),

  // Favourites
  getFavourites:  () => ipcRenderer.invoke('get-favourites'),
  setFavourites: (ids) => ipcRenderer.invoke('set-favourites', ids),

  // Settings
  getSettings:    () => ipcRenderer.invoke('get-settings'),
  setSettings: (s)   => ipcRenderer.invoke('set-settings', s),

  // AI
  anthropic:   (body) => ipcRenderer.invoke('anthropic-request', body),

  // File system
  browseFolder:   () => ipcRenderer.invoke('browse-folder'),
  scanFolder: (p)    => ipcRenderer.invoke('scan-folder', p),
  detectGames:    () => ipcRenderer.invoke('detect-games'),
  createModFolder:(p) => ipcRenderer.invoke('create-mod-folder', p),
  readFile:   (p)    => ipcRenderer.invoke('read-file', p),
  saveFile:  (opts)  => ipcRenderer.invoke('save-file', opts),
  installMod:(opts)  => ipcRenderer.invoke('install-mod', opts),

  // Updater
  updateAndRestart:(opts) => ipcRenderer.invoke('update-and-restart', opts),
  getUpdateResults:()     => ipcRenderer.invoke('get-update-results'),
  clearUpdateResults:()   => ipcRenderer.invoke('clear-update-results'),

  // Platform
  platform: process.platform,
})
