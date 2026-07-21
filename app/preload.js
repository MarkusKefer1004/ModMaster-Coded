const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('MM', {
  // Window controls
  minimize:        () => ipcRenderer.invoke('window-minimize'),
  maximize:        () => ipcRenderer.invoke('window-maximize'),
  close:           () => ipcRenderer.invoke('window-close'),
  quit:            () => ipcRenderer.invoke('window-quit'),
  isMaximized:     () => ipcRenderer.invoke('window-is-maximized'),
  isFirstLaunch:   () => ipcRenderer.invoke('is-first-launch'),

  // Storage
  getApiKey:       () => ipcRenderer.invoke('get-api-key'),
  setApiKey:   (key)  => ipcRenderer.invoke('set-api-key', key),
  getRepoUrl:      () => ipcRenderer.invoke('get-repo-url'),
  setRepoUrl:  (url)  => ipcRenderer.invoke('set-repo-url', url),
  getAiProxy:      () => ipcRenderer.invoke('get-ai-proxy'),
  setAiProxy:  (p)    => ipcRenderer.invoke('set-ai-proxy', p),
  getFavourites:   () => ipcRenderer.invoke('get-favourites'),
  setFavourites: (ids) => ipcRenderer.invoke('set-favourites', ids),
  getSettings:     () => ipcRenderer.invoke('get-settings'),
  setSettings:  (s)   => ipcRenderer.invoke('set-settings', s),

  // AI
  anthropic:    (body) => ipcRenderer.invoke('anthropic-request', body),

  // File system
  browseFolder:    () => ipcRenderer.invoke('browse-folder'),
  scanFolder:   (p)   => ipcRenderer.invoke('scan-folder', p),
  detectGames:     () => ipcRenderer.invoke('detect-games'),
  listDrives:      () => ipcRenderer.invoke('list-drives'),
  scanLocation:(opts) => ipcRenderer.invoke('scan-location', opts),
  createModFolder:(p)  => ipcRenderer.invoke('create-mod-folder', p),
  readFile:     (p)   => ipcRenderer.invoke('read-file', p),
  saveFile:  (opts)   => ipcRenderer.invoke('save-file', opts),
  installMod: (opts)  => ipcRenderer.invoke('install-mod', opts),
  uninstallMod:(opts) => ipcRenderer.invoke('uninstall-mod', opts),
  listInstalls:   ()  => ipcRenderer.invoke('list-installs'),

  // Steam Workshop
  scanWorkshop:  (appId) => ipcRenderer.invoke('scan-workshop', appId),
  scanWorkshopAll:   ()  => ipcRenderer.invoke('scan-workshop-all'),

  // Self-updater
  updateAndRestart: (opts) => ipcRenderer.invoke('update-and-restart', opts),
  getUpdateResults:    ()  => ipcRenderer.invoke('get-update-results'),
  clearUpdateResults:  ()  => ipcRenderer.invoke('clear-update-results'),

  platform: process.platform,
})
