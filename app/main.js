const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs   = require('fs')
const https = require('https')
const http  = require('http')
const os   = require('os')
const { execSync } = require('child_process')

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'modmaster-config.json')
const BACKUP_DIR  = path.join(app.getPath('userData'), 'mm-backups')
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')) } catch { return {} } }
function saveConfig(d) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(d,null,2),'utf8') }

// ── Known moddable games (folder name → mod metadata) ─────────────────────────
const KNOWN = {
  'Grand Theft Auto V':     {name:'GTA V',          color:'#f07050', modFolder:'scripts',  publisher:'Rockstar',     appId:'271590'},
  'Skyrim Special Edition': {name:'Skyrim SE',       color:'#8b7cef', modFolder:'Data',     publisher:'Bethesda',     appId:'489830'},
  'SkyrimVR':               {name:'Skyrim VR',       color:'#8b7cef', modFolder:'Data',     publisher:'Bethesda',     appId:'611670'},
  'Minecraft':              {name:'Minecraft',       color:'#4ade80', modFolder:'mods',     publisher:'Mojang',       appId:null},
  'Red Dead Redemption 2':  {name:'RDR2',            color:'#f5a623', modFolder:'lml',      publisher:'Rockstar',     appId:'1174180'},
  'Stardew Valley':         {name:'Stardew Valley',  color:'#2dd4a0', modFolder:'Mods',     publisher:'ConcernedApe', appId:'413150'},
  'Cyberpunk 2077':         {name:'Cyberpunk 2077',  color:'#60a0f0', modFolder:'mods',     publisher:'CDPR',         appId:'1091500'},
  'Cities Skylines II':     {name:'Cities Skylines', color:'#e06090', modFolder:'Mods',     publisher:'Paradox',      appId:'949230'},
  'Elden Ring':             {name:'Elden Ring',      color:'#f5a623', modFolder:'mods',     publisher:'Bandai',       appId:'1245620'},
  'Dark Souls III':         {name:'Dark Souls III',  color:'#888780', modFolder:'mods',     publisher:'Bandai',       appId:'374320'},
  'Fallout 4':              {name:'Fallout 4',       color:'#b8e050', modFolder:'Data',     publisher:'Bethesda',     appId:'377160'},
  'The Witcher 3':          {name:'Witcher 3',       color:'#c0a060', modFolder:'Mods',     publisher:'CDPR',         appId:'292030'},
  'Monster Hunter World':   {name:'MH World',        color:'#f07850', modFolder:'nativePC', publisher:'Capcom',       appId:'582010'},
  'Valheim':                {name:'Valheim',         color:'#6090a0', modFolder:'BepInEx',  publisher:'IronGate',     appId:'892970'},
  'RimWorld':               {name:'RimWorld',        color:'#d09060', modFolder:'Mods',     publisher:'Ludeon',       appId:'294100'},
}

// Secondary indexes so Epic/Xbox/GOG folder or display names also resolve to KNOWN
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const KNOWN_BY_NORM  = {}
const KNOWN_BY_APPID = {}
for (const [folder, info] of Object.entries(KNOWN)) {
  KNOWN_BY_NORM[norm(folder)]    = info
  KNOWN_BY_NORM[norm(info.name)] = info
  if (info.appId) KNOWN_BY_APPID[info.appId] = { ...info, folderName: folder }
}
function resolveKnown(...candidates) {
  for (const c of candidates) {
    if (!c) continue
    if (KNOWN[c]) return { info: KNOWN[c], folderName: c }
    const n = KNOWN_BY_NORM[norm(c)]
    if (n) return { info: n, folderName: c }
  }
  return null
}
// Build a game object in the standard shape from a resolved KNOWN entry
function makeGame(info, folderName, gamePath, platform, appId, isXbox) {
  const modPath = path.join(gamePath, info.modFolder)
  return {
    id: info.name.toLowerCase().replace(/\s/g, '-'),
    name: info.name, folderName, gamePath,
    modPath: fs.existsSync(modPath) ? modPath : gamePath,
    modFolderExists: fs.existsSync(modPath),
    color: info.color, publisher: info.publisher,
    platform, appId: appId || info.appId || null, isXbox: !!isXbox,
  }
}

// ── Generic game building (detect ANY installed game, not just KNOWN) ─────────
function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = x => Math.round(255 * x).toString(16).padStart(2, '0')
  return '#' + to(f(0)) + to(f(8)) + to(f(4))
}
// Stable colour per game name (so unknown games still look distinct)
function hashColor(s) {
  let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return hslToHex(h % 360, 58, 62)
}
// Skip launcher junk and system/container folders that aren't a real game
function isNonGame(name) {
  const n = String(name || '')
  if (/redist|proton|steam ?(vr|works| linux runtime| controller)|directx|vcredist|dotnet|common redistributable|_commonredist|dedicated server/i.test(n)) return true
  if (/^(windows|program files.*|programdata|users|\$recycle\.bin|system volume information|recovery|appdata|temp|tmp|perflogs|steam|steamapps|steamlibrary|xboxgames|epic games|gog games|gog galaxy|origin games|ubisoft.*|riot games|intel|amd|nvidia|drivers|msocache|config\.msi|windows\.old)$/i.test(n.trim())) return true
  return false
}
function platformPublisher(p) {
  return ({ steam: 'Steam', epic: 'Epic Games', xbox: 'Xbox', gog: 'GOG' })[p] || 'PC'
}
// Guess a likely mods folder inside a game dir; fall back to the game dir itself
function guessModFolder(gamePath) {
  for (const sub of ['mods', 'Mods', 'Data', 'BepInEx', 'scripts', 'lml', 'nativePC']) {
    try { if (fs.existsSync(path.join(gamePath, sub))) return path.join(gamePath, sub) } catch {}
  }
  return gamePath
}
// Build a game object for ANY game — enriched from KNOWN when recognised, else generic
function buildGame(o) {
  const known = resolveKnown(o.folderName, o.name)
  const info = known ? known.info : null
  const name = (info ? info.name : (o.name || o.folderName || 'Game')).trim()
  const modPath = info ? path.join(o.gamePath, info.modFolder) : guessModFolder(o.gamePath)
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game',
    name, folderName: o.folderName || name, gamePath: o.gamePath,
    modPath: fs.existsSync(modPath) ? modPath : o.gamePath,
    modFolderExists: fs.existsSync(modPath),
    color: info ? info.color : hashColor(name),
    publisher: info ? info.publisher : platformPublisher(o.platform),
    platform: o.platform || 'other',
    appId: o.appId || (info ? info.appId : null),
    isXbox: !!o.isXbox, known: !!info,
  }
}

// ── Windows registry helpers (native, no npm) ─────────────────────────────────
function expandHive(k) {
  return k.replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\')
          .replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\')
          .replace(/^HKCR\\/i, 'HKEY_CLASSES_ROOT\\')
          .replace(/^HKU\\/i,  'HKEY_USERS\\')
          .replace(/^HKCC\\/i, 'HKEY_CURRENT_CONFIG\\')
}
// Read a single registry value; returns trimmed string or null
function regQuery(keyPath, valueName) {
  try {
    const out = execSync(`reg query "${keyPath}" /v "${valueName}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const esc = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = out.match(new RegExp(esc + '\\s+REG_\\w+\\s+(.+)'))
    return m ? m[1].trim() : null
  } catch { return null }
}
// List immediate subkey names under a registry key
function regSubkeys(keyPath) {
  try {
    const out = execSync(`reg query "${keyPath}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const full = expandHive(keyPath).toLowerCase()
    return out.split(/\r?\n/).map(l => l.trim())
      .filter(l => l.toLowerCase().startsWith(full + '\\'))
      .map(l => l.slice(full.length + 1))
      .filter(l => l && !l.includes('\\'))
  } catch { return [] }
}

// ── Steam library discovery (registry → libraryfolders.vdf) ───────────────────
function getSteamLibraries() {
  let steamPath = regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath')
               || regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')
               || regQuery('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath')
  if (!steamPath) return []
  steamPath = steamPath.replace(/\//g, '\\').replace(/[\\/]+$/, '')
  const libs = [steamPath]
  for (const vdf of [
    path.join(steamPath, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamPath, 'config', 'libraryfolders.vdf'),
  ]) {
    try {
      const txt = fs.readFileSync(vdf, 'utf8')
      const re = /"path"\s+"([^"]+)"/g
      let m
      while ((m = re.exec(txt))) libs.push(m[1].replace(/\\\\/g, '\\'))
    } catch {}
  }
  return [...new Set(libs.map(l => l.replace(/[\\/]+$/, '')))]
}

// ── Drive / folder scanning (auto across all drives, or a user-chosen location) ─
function allDriveRoots() {
  const roots = []
  for (let c = 67; c <= 90; c++) {            // C: .. Z:
    const r = String.fromCharCode(c) + ':\\'
    try { if (fs.existsSync(r)) roots.push(r) } catch {}
  }
  return roots
}
// Common places games live, relative to a drive root or a chosen folder
const COMMON_SUBPATHS = [
  ['SteamLibrary\\steamapps\\common', 'steam'],
  ['Steam\\steamapps\\common', 'steam'],
  ['steamapps\\common', 'steam'],
  ['Program Files (x86)\\Steam\\steamapps\\common', 'steam'],
  ['Program Files\\Steam\\steamapps\\common', 'steam'],
  ['Program Files\\Epic Games', 'epic'],
  ['Program Files (x86)\\Epic Games', 'epic'],
  ['Epic Games', 'epic'],
  ['XboxGames', 'xbox'],
  ['GOG Games', 'gog'],
  ['GOG Galaxy\\Games', 'gog'],
  ['Program Files (x86)\\GOG Galaxy\\Games', 'gog'],
  ['Games', 'other'],
]
function guessPlatform(p) {
  const s = String(p).toLowerCase()
  if (s.includes('steamapps')) return 'steam'
  if (s.includes('xboxgames')) return 'xbox'
  if (s.includes('epic')) return 'epic'
  if (s.includes('gog')) return 'gog'
  return 'other'
}
// Treat every immediate subfolder of `base` as a game (skipping launcher junk)
function scanBaseForGames(base, platform) {
  const out = []
  let entries; try { entries = fs.readdirSync(base, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    if (!e.isDirectory() || isNonGame(e.name)) continue
    out.push(buildGame({ name: e.name, folderName: e.name, gamePath: path.join(base, e.name), platform, isXbox: platform === 'xbox' }))
  }
  return out
}
// Scan a root for games. Only known game-library subpaths by default; pass
// includeDirect=true (a folder the user explicitly picked) to also treat the
// root's own subfolders as games.
function scanRootForGames(root, includeDirect) {
  const out = []
  if (includeDirect) out.push(...scanBaseForGames(root, guessPlatform(root)))
  for (const [sub, plat] of COMMON_SUBPATHS) out.push(...scanBaseForGames(path.join(root, sub), plat))
  return out
}

let mainWindow
let tray

// ── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1200,
    height:          800,
    minWidth:        960,
    minHeight:       640,
    frame:           false,      // custom titlebar
    transparent:     false,
    backgroundColor: '#0d0f12',
    show:            false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'modmaster.html'))
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // F12 (or Ctrl+Shift+I) toggles DevTools — for troubleshooting
  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && (input.key === 'F12' ||
        (input.control && input.shift && String(input.key).toLowerCase() === 'i'))) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  // Use a simple fallback icon — replace with real .ico in production
  try {
    const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
    const icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty()
    tray = new Tray(icon)
    tray.setToolTip('ModMaster')
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open ModMaster', click: () => { if(mainWindow) mainWindow.show(); else createWindow() } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ]))
    tray.on('double-click', () => { if(mainWindow) mainWindow.show() })
  } catch(e) {
    console.log('Tray creation skipped:', e.message)
  }
}

app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms
  // App quits only via tray menu or ipcMain close handler
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.handle('window-minimize',  () => mainWindow?.minimize())
ipcMain.handle('window-maximize',  () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.handle('window-close',     () => { mainWindow?.hide() }) // hide to tray
ipcMain.handle('window-quit',      () => { app.quit() })
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false)

// ── First launch flag ────────────────────────────────────────────────────────
ipcMain.handle('is-first-launch', () => {
  const cfg = loadConfig()
  if (!cfg.launchedBefore) {
    cfg.launchedBefore = true
    saveConfig(cfg)
    return true
  }
  return false
})

// ── API key ──────────────────────────────────────────────────────────────────
ipcMain.handle('get-api-key', () => loadConfig().apiKey || '')
ipcMain.handle('set-api-key', (e, key) => { const c=loadConfig(); c.apiKey=key.trim(); saveConfig(c); return true })

// ── Repo URL ─────────────────────────────────────────────────────────────────
ipcMain.handle('get-repo-url', () => loadConfig().repoUrl || '')
ipcMain.handle('set-repo-url', (e, url) => { const c=loadConfig(); c.repoUrl=url; saveConfig(c); return true })

// ── AI proxy (key-free AI via your own server; blank = use per-user key) ──────
ipcMain.handle('get-ai-proxy', () => loadConfig().aiProxy || { url: '', token: '' })
ipcMain.handle('set-ai-proxy', (e, p) => {
  const c = loadConfig()
  c.aiProxy = { url: ((p && p.url) || '').trim(), token: ((p && p.token) || '').trim() }
  saveConfig(c); return true
})

// ── Favourite games ──────────────────────────────────────────────────────────
ipcMain.handle('get-favourites', () => loadConfig().favourites || [])
ipcMain.handle('set-favourites', (e, ids) => { const c=loadConfig(); c.favourites=ids; saveConfig(c); return true })

// ── User settings (theme, background etc.) ───────────────────────────────────
ipcMain.handle('get-settings', () => loadConfig().settings || {})
ipcMain.handle('set-settings', (e, s) => { const c=loadConfig(); c.settings={...c.settings,...s}; saveConfig(c); return true })

// ── Anthropic API ────────────────────────────────────────────────────────────
// POST JSON to any http(s) URL, resolve the parsed JSON (never rejects).
function postJson(urlStr, payload, extraHeaders) {
  return new Promise((resolve) => {
    let u
    try { u = new URL(urlStr) } catch { return resolve({ error: 'bad_url', message: 'Invalid URL: ' + urlStr }) }
    const mod = u.protocol === 'http:' ? http : https
    const headers = Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, extraHeaders || {})
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search, method: 'POST', headers,
    }, (res) => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({ error: 'parse_error' }) } })
    })
    req.on('error', err => resolve({ error: 'network_error', message: err.message }))
    req.write(payload); req.end()
  })
}

ipcMain.handle('anthropic-request', async (e, body) => {
  const cfg = loadConfig()
  const payload = JSON.stringify(body)
  const proxy = cfg.aiProxy && cfg.aiProxy.url ? cfg.aiProxy : null

  // Preferred: route through the configured proxy (key lives server-side → users need no key)
  if (proxy) {
    const endpoint = proxy.url.replace(/\/+$/, '') + '/api/anthropic'
    const headers = proxy.token ? { 'x-mm-token': proxy.token } : {}
    return postJson(endpoint, payload, headers)
  }

  // Fallback: the user's own key (BYO — power users / no proxy configured)
  const key = cfg.apiKey || ''
  if (!key) return { error: 'no_api_key', message: 'No AI connection yet — add a proxy URL or your own API key in Settings.' }
  return postJson('https://api.anthropic.com/v1/messages', payload, { 'x-api-key': key, 'anthropic-version': '2023-06-01' })
})

// ── Browse for folder ────────────────────────────────────────────────────────
ipcMain.handle('browse-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title:'Select game folder', properties:['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

// ── Open an external link (browser or Steam client) ──────────────────────────
ipcMain.handle('open-external', async (e, url) => {
  try {
    if (typeof url === 'string' && /^(https?|steam):/i.test(url)) { await shell.openExternal(url); return { success: true } }
    return { success: false, error: 'blocked' }
  } catch (err) { return { success: false, error: err.message } }
})

// ── Scan folder for mods ─────────────────────────────────────────────────────
ipcMain.handle('scan-folder', async (e, folderPath) => {
  const EXTS = new Set(['.lua','.cfg','.xml','.asi','.dll','.ytd','.ydr','.ydd','.rpf','.zip','.pak','.json'])
  const found = []
  function scan(dir, depth) {
    if (depth > 4) return
    let entries; try { entries = fs.readdirSync(dir,{withFileTypes:true}) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { scan(full, depth+1) }
      else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
        let stat; try { stat=fs.statSync(full) } catch { continue }
        found.push({ name:path.basename(entry.name,path.extname(entry.name)),
          file:path.relative(folderPath,full), fullPath:full,
          ext:path.extname(entry.name).slice(1).toUpperCase(), size:stat.size, modified:stat.mtime.toISOString() })
      }
    }
  }
  try { scan(folderPath,0); return {success:true,mods:found} }
  catch(e) { return {success:false,error:e.message,mods:[]} }
})

// ── Detect installed games (platform-native data sources, not folder guessing) ─
ipcMain.handle('detect-games', async () => {
  const detected = []

  // Steam: registry → libraryfolders.vdf → appmanifest_*.acf
  try {
    for (const lib of getSteamLibraries()) {
      const steamapps = path.join(lib, 'steamapps')
      let files; try { files = fs.readdirSync(steamapps) } catch { continue }
      for (const f of files) {
        if (!/^appmanifest_\d+\.acf$/.test(f)) continue
        let acf; try { acf = fs.readFileSync(path.join(steamapps, f), 'utf8') } catch { continue }
        const appId      = (acf.match(/"appid"\s+"(\d+)"/i) || [])[1]
        const installdir = (acf.match(/"installdir"\s+"([^"]+)"/i) || [])[1]
        const acfName    = (acf.match(/"name"\s+"([^"]+)"/i) || [])[1]
        if (!installdir || isNonGame(acfName || installdir)) continue
        const gamePath = path.join(steamapps, 'common', installdir)
        if (!fs.existsSync(gamePath)) continue
        detected.push(buildGame({ name: acfName || installdir, folderName: installdir, gamePath, platform: 'steam', appId }))
      }
    }
  } catch {}

  // Epic Games: .item manifests in ProgramData\Epic\EpicGamesLauncher\Data\Manifests
  try {
    const manDir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
    let items; try { items = fs.readdirSync(manDir).filter(f => f.endsWith('.item')) } catch { items = [] }
    for (const it of items) {
      let man; try { man = JSON.parse(fs.readFileSync(path.join(manDir, it), 'utf8')) } catch { continue }
      const loc = man.InstallLocation
      if (!loc || !fs.existsSync(loc)) continue
      const folder = man.MandatoryAppFolderName || path.basename(loc)
      if (isNonGame(man.DisplayName || folder)) continue
      detected.push(buildGame({ name: man.DisplayName || folder, folderName: folder, gamePath: loc, platform: 'epic' }))
    }
  } catch {}

  // Xbox Game Pass: scan {Drive}:\XboxGames + read MicrosoftGame.config for real title
  try {
    for (const root of allDriveRoots()) {
      const base = path.join(root, 'XboxGames')
      let entries; try { entries = fs.readdirSync(base, { withFileTypes: true }) } catch { continue }
      for (const e of entries) {
        if (!e.isDirectory()) continue
        const contentDir = path.join(base, e.name, 'Content')
        const gamePath = fs.existsSync(contentDir) ? contentDir : path.join(base, e.name)
        let title = e.name
        for (const cfgName of ['MicrosoftGame.config', 'MicrosoftGameConfig.mgc']) {
          try {
            const cfg = fs.readFileSync(path.join(gamePath, cfgName), 'utf8')
            const t = (cfg.match(/DefaultDisplayName\s*=\s*"([^"]+)"/i) ||
                       cfg.match(/<DisplayName>([^<]+)<\/DisplayName>/i) ||
                       cfg.match(/<Name>([^<]+)<\/Name>/i) || [])[1]
            if (t) { title = t; break }
          } catch {}
        }
        if (isNonGame(title)) continue
        detected.push(buildGame({ name: title, folderName: e.name, gamePath, platform: 'xbox', isXbox: true }))
      }
    }
  } catch {}

  // GOG: registry HKLM\SOFTWARE\GOG.com\Games
  try {
    for (const root of ['HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'HKLM\\SOFTWARE\\GOG.com\\Games']) {
      for (const sub of regSubkeys(root)) {
        const gpath = regQuery(`${root}\\${sub}`, 'path')
        const gname = regQuery(`${root}\\${sub}`, 'gameName')
        if (!gpath || !fs.existsSync(gpath)) continue
        if (isNonGame(gname || path.basename(gpath))) continue
        detected.push(buildGame({ name: gname || path.basename(gpath), folderName: path.basename(gpath), gamePath: gpath, platform: 'gog' }))
      }
    }
  } catch {}

  // Fallback: scan common game-library locations on EVERY drive (C:..Z:)
  try {
    for (const root of allDriveRoots()) {
      for (const g of scanRootForGames(root, false)) detected.push(g)
    }
  } catch {}

  // User-added custom games (always included so they persist across launches)
  try { for (const g of (loadConfig().customGames || [])) detected.push({ ...g, custom: true }) } catch {}

  // Dedup by game name — native passes run first, so accurate entries win
  const seen = new Set()
  return detected.filter(g => { if (seen.has(g.name)) return false; seen.add(g.name); return true })
})

// ── List available drives (C:..Z: that exist) ────────────────────────────────
ipcMain.handle('list-drives', async () => allDriveRoots())

// ── Scan a specific drive or folder the user picked ──────────────────────────
ipcMain.handle('scan-location', async (e, opts) => {
  try {
    const root = opts && opts.path
    if (!root) return { success: false, error: 'no_path', games: [] }
    // A folder the user browsed to → also treat its own subfolders as games (direct).
    // A whole drive → libraries only, so we don't list Windows/Users/etc.
    const found = scanRootForGames(root, !!(opts && opts.direct))
    const seen = new Set()
    const games = found.filter(g => { if (seen.has(g.name)) return false; seen.add(g.name); return true })
    return { success: true, games }
  } catch (err) { return { success: false, error: err.message, games: [] } }
})

// ── User-added custom games (persist in config, included in detect-games) ─────
ipcMain.handle('get-custom-games', async () => loadConfig().customGames || [])
ipcMain.handle('add-custom-game', async (e, game) => {
  try {
    if (!game || !game.gamePath) return { success: false, error: 'no_path' }
    const c = loadConfig(); c.customGames = c.customGames || []
    const name = (game.name || path.basename(game.gamePath) || 'Custom game').trim()
    const entry = {
      id: game.id || ('custom-' + name.toLowerCase().replace(/\s+/g, '-')),
      name, folderName: path.basename(game.gamePath),
      gamePath: game.gamePath,
      modPath: game.modPath || game.gamePath,
      modFolderExists: fs.existsSync(game.modPath || game.gamePath),
      color: game.color || '#8a92a6', publisher: game.publisher || 'Custom',
      platform: game.platform || 'other', appId: game.appId || null,
      isXbox: !!game.isXbox, custom: true,
    }
    c.customGames = c.customGames.filter(g => g.gamePath !== entry.gamePath && g.id !== entry.id)
    c.customGames.push(entry)
    saveConfig(c)
    return { success: true, game: entry }
  } catch (err) { return { success: false, error: err.message } }
})
ipcMain.handle('remove-custom-game', async (e, id) => {
  const c = loadConfig(); c.customGames = (c.customGames || []).filter(g => g.id !== id); saveConfig(c)
  return { success: true }
})

// ── Detection diagnostics (troubleshooting why games aren't found) ────────────
ipcMain.handle('diagnose-detection', async () => {
  const r = { version: '2.1', platform: process.platform, drives: [], steamPath: null, steamLibraries: [],
              steamGamesPerLib: {}, steamSample: [], epicDir: null, epicCount: 0, xbox: [], gogKeys: 0, errors: [] }
  const safe = (label, fn) => { try { return fn() } catch (e) { r.errors.push(label + ': ' + e.message); return undefined } }
  r.drives = safe('drives', () => allDriveRoots()) || []
  r.steamPath = safe('steamPath', () => regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'))
  r.steamLibraries = safe('steamLibraries', () => getSteamLibraries()) || []
  for (const lib of r.steamLibraries) {
    safe('steamGames[' + lib + ']', () => {
      const dir = path.join(lib, 'steamapps')
      const acf = fs.readdirSync(dir).filter(f => /^appmanifest_\d+\.acf$/.test(f))
      r.steamGamesPerLib[lib] = acf.length
      for (const f of acf.slice(0, 40)) {
        const t = fs.readFileSync(path.join(dir, f), 'utf8')
        const name = (t.match(/"name"\s+"([^"]+)"/i) || [])[1]
        if (name && !isNonGame(name) && r.steamSample.length < 30) r.steamSample.push(name)
      }
    })
  }
  const manDir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests')
  r.epicDir = manDir
  r.epicCount = safe('epic', () => fs.readdirSync(manDir).filter(f => f.endsWith('.item')).length) ?? 'n/a'
  for (const root of r.drives) {
    safe('xbox[' + root + ']', () => { const b = path.join(root, 'XboxGames'); if (fs.existsSync(b)) r.xbox.push(b + ' (' + fs.readdirSync(b).length + ' folders)') })
  }
  r.gogKeys = safe('gog', () => regSubkeys('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games').length) ?? 'n/a'
  return r
})

// ── Steam Workshop ────────────────────────────────────────────────────────────
// Existing <lib>/steamapps/workshop/content/<appId> dirs across all libraries
function workshopContentDirs(appId) {
  const dirs = []
  for (const lib of getSteamLibraries()) {
    const d = path.join(lib, 'steamapps', 'workshop', 'content', String(appId))
    if (fs.existsSync(d)) dirs.push(d)
  }
  return dirs
}
// Resolve a Steam appId → game name via the public Store API (best-effort, online)
function steamStoreName(appId) {
  return new Promise((resolve) => {
    const req = https.get(
      { hostname: 'store.steampowered.com', path: `/api/appdetails?appids=${appId}&filters=basic`, timeout: 5000 },
      (res) => {
        let d = ''
        res.on('data', c => d += c)
        res.on('end', () => { try { const j = JSON.parse(d); resolve(j?.[appId]?.data?.name || null) } catch { resolve(null) } })
      }
    )
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
  })
}

// Scan one game's subscribed Workshop items
ipcMain.handle('scan-workshop', async (e, appId) => {
  try {
    const items = []
    for (const dir of workshopContentDirs(appId)) {
      let subs; try { subs = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
      for (const s of subs) {
        if (!s.isDirectory()) continue
        const itemPath = path.join(dir, s.name)
        let files = []; try { files = fs.readdirSync(itemPath) } catch {}
        let size = 0
        for (const f of files) { try { size += fs.statSync(path.join(itemPath, f)).size } catch {} }
        items.push({ id: s.name, path: itemPath, fileCount: files.length, files: files.slice(0, 50), size })
      }
    }
    const known = KNOWN_BY_APPID[String(appId)]
    return { success: true, appId: String(appId), gameName: known ? known.name : null, items }
  } catch (err) { return { success: false, error: err.message, items: [] } }
})

// Scan all games that have Workshop content installed; resolve names (KNOWN, then Store API)
ipcMain.handle('scan-workshop-all', async () => {
  try {
    const byApp = {}
    for (const lib of getSteamLibraries()) {
      const contentRoot = path.join(lib, 'steamapps', 'workshop', 'content')
      let apps; try { apps = fs.readdirSync(contentRoot, { withFileTypes: true }) } catch { continue }
      for (const a of apps) {
        if (!a.isDirectory() || !/^\d+$/.test(a.name)) continue
        let n = 0
        try { n = fs.readdirSync(path.join(contentRoot, a.name), { withFileTypes: true }).filter(x => x.isDirectory()).length } catch {}
        if (n > 0) byApp[a.name] = (byApp[a.name] || 0) + n
      }
    }
    const games = []
    for (const [appId, itemCount] of Object.entries(byApp)) {
      let name = KNOWN_BY_APPID[appId] ? KNOWN_BY_APPID[appId].name : null
      if (!name) name = await steamStoreName(appId)
      games.push({ appId, name: name || `App ${appId}`, itemCount })
    }
    games.sort((a, b) => b.itemCount - a.itemCount)
    return { success: true, games }
  } catch (err) { return { success: false, error: err.message, games: [] } }
})

// ── Create mod folder ────────────────────────────────────────────────────────
ipcMain.handle('create-mod-folder', async (e, folderPath) => {
  try { fs.mkdirSync(folderPath,{recursive:true}); return {success:true} }
  catch(err) { return {success:false,error:err.message} }
})

// ── Read / write files ───────────────────────────────────────────────────────
ipcMain.handle('read-file',  async (e, p) => { try { return {success:true,content:fs.readFileSync(p,'utf8')} } catch(err) { return {success:false,error:err.message} } })
ipcMain.handle('save-file',  async (e, {filePath,content}) => { try { fs.writeFileSync(filePath,content,'utf8'); return {success:true} } catch(err) { return {success:false,error:err.message} } })

// ── Install mod (copy into game folder, backing up any file it overwrites) ────
ipcMain.handle('install-mod', async (e, {sourcePath, gamePath, name}) => {
  try {
    const dest = path.join(gamePath, path.basename(sourcePath))
    const cfg = loadConfig(); cfg.installs = cfg.installs || []
    // Back up any existing file before overwriting, so installs are always reversible
    let backup = null
    if (fs.existsSync(dest)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
      backup = path.join(BACKUP_DIR, path.basename(dest) + '.' + Date.now() + '.bak')
      fs.copyFileSync(dest, backup)
    }
    fs.copyFileSync(sourcePath, dest)
    const id = 'inst_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)
    cfg.installs.push({ id, name: name || path.basename(sourcePath), dest, backup, gamePath, ts: new Date().toISOString() })
    saveConfig(cfg)
    return { success: true, id, backedUp: !!backup }
  } catch (err) { return { success: false, error: err.message } }
})

// ── Uninstall mod (remove installed file, restore the backup if there was one) ─
ipcMain.handle('uninstall-mod', async (e, { id, dest }) => {
  try {
    const cfg = loadConfig(); cfg.installs = cfg.installs || []
    const rec = cfg.installs.find(r => (id && r.id === id) || (dest && r.dest === dest))
    const target = rec ? rec.dest : dest
    if (target && fs.existsSync(target)) fs.unlinkSync(target)
    let restored = false
    if (rec && rec.backup && fs.existsSync(rec.backup)) {
      fs.copyFileSync(rec.backup, rec.dest); fs.unlinkSync(rec.backup); restored = true
    }
    if (rec) { cfg.installs = cfg.installs.filter(r => r.id !== rec.id); saveConfig(cfg) }
    return { success: true, restored }
  } catch (err) { return { success: false, error: err.message } }
})

// ── List installed mods (from the install registry in config) ─────────────────
ipcMain.handle('list-installs', async () => loadConfig().installs || [])

// ── Tool installer (download modding tools into the game folder) ──────────────
// Download a URL to a file, following redirects (GitHub release assets redirect).
function downloadFile(url, dest, redirects = 0) {
  return new Promise((resolve) => {
    if (redirects > 6) return resolve({ success: false, error: 'too_many_redirects' })
    let u; try { u = new URL(url) } catch { return resolve({ success: false, error: 'bad_url' }) }
    const mod = u.protocol === 'http:' ? http : https
    const req = mod.get({
      hostname: u.hostname, path: u.pathname + u.search, port: u.port || (u.protocol === 'http:' ? 80 : 443),
      headers: { 'User-Agent': 'ModMaster', 'Accept': 'application/octet-stream' },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume()
        return resolve(downloadFile(new URL(res.headers.location, u).toString(), dest, redirects + 1))
      }
      if (res.statusCode !== 200) { res.resume(); return resolve({ success: false, error: 'http_' + res.statusCode }) }
      const out = fs.createWriteStream(dest)
      res.pipe(out)
      out.on('finish', () => out.close(() => resolve({ success: true })))
      out.on('error', (er) => resolve({ success: false, error: er.message }))
    })
    req.on('error', (er) => resolve({ success: false, error: er.message }))
  })
}
// Resolve a GitHub latest-release asset download URL by filename pattern
function ghLatestAsset(repo, patternSource) {
  return new Promise((resolve) => {
    const req = https.get({
      hostname: 'api.github.com', path: `/repos/${repo}/releases/latest`,
      headers: { 'User-Agent': 'ModMaster', 'Accept': 'application/vnd.github+json' },
    }, (res) => {
      let d = ''; res.on('data', c => d += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(d); const re = new RegExp(patternSource, 'i')
          const asset = (j.assets || []).find(a => re.test(a.name))
          resolve(asset ? { success: true, url: asset.browser_download_url, name: asset.name, tag: j.tag_name }
                        : { success: false, error: 'asset_not_found' })
        } catch (er) { resolve({ success: false, error: 'parse_' + er.message }) }
      })
    })
    req.on('error', (er) => resolve({ success: false, error: er.message }))
  })
}
// One-click install of a tool: download (direct URL or resolved GitHub asset) then unzip/copy into the game
ipcMain.handle('install-tool', async (e, opts) => {
  try {
    const gamePath = opts && opts.gamePath
    if (!gamePath || !fs.existsSync(gamePath)) return { success: false, error: 'game_folder_missing' }
    let url = opts.url
    if (!url && opts.repo) {
      const r = await ghLatestAsset(opts.repo, opts.assetPattern || '\\.zip$')
      if (!r.success) return { success: false, error: 'resolve_' + r.error }
      url = r.url
    }
    if (!url) return { success: false, error: 'no_url' }
    const tmp = path.join(os.tmpdir(), 'mm-tool-' + Date.now() + (opts.unzip ? '.zip' : (path.extname(url.split('?')[0]) || '.bin')))
    const dl = await downloadFile(url, tmp)
    if (!dl.success) return { success: false, error: 'download_' + dl.error }
    if (opts.unzip) {
      const target = opts.subdir ? path.join(gamePath, opts.subdir) : gamePath
      try { fs.mkdirSync(target, { recursive: true }) } catch {}
      try {
        const q = s => "'" + String(s).replace(/'/g, "''") + "'"
        execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath ${q(tmp)} -DestinationPath ${q(target)} -Force"`, { stdio: ['ignore', 'ignore', 'pipe'] })
      } catch (err) { try { fs.unlinkSync(tmp) } catch {}; return { success: false, error: 'extract_failed' } }
      try { fs.unlinkSync(tmp) } catch {}
      return { success: true, installedTo: target }
    }
    const target = path.join(gamePath, path.basename(url.split('?')[0]))
    try { fs.copyFileSync(tmp, target); fs.unlinkSync(tmp) } catch (err) { return { success: false, error: err.message } }
    return { success: true, installedTo: target }
  } catch (err) { return { success: false, error: err.message } }
})
// Open a folder in Explorer (for guided installs)
ipcMain.handle('open-path', async (e, p) => {
  try { const r = await shell.openPath(String(p || '')); return { success: !r, error: r || null } }
  catch (err) { return { success: false, error: err.message } }
})
// Grant this user full control of a protected (Xbox/WindowsApps) game folder — needs admin (UAC)
ipcMain.handle('grant-game-access', async (e, gamePath) => {
  try {
    if (!gamePath) return { success: false, error: 'no_path' }
    const bat = path.join(os.tmpdir(), 'mm-grant-' + Date.now() + '.bat')
    fs.writeFileSync(bat, '@echo off\r\ntakeown /f "' + gamePath + '" /r /d y\r\nicacls "' + gamePath + '" /grant "%USERNAME%":(F) /t\r\n')
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '${bat.replace(/'/g, "''")}' -Verb RunAs"`, { stdio: 'ignore' })
    return { success: true, elevated: true }
  } catch (err) { return { success: false, error: err.message } }
})

// ── Self-updater ─────────────────────────────────────────────────────────────
ipcMain.handle('update-and-restart', async (e, {repoUrl}) => {
  try {
    const cfg = loadConfig(); cfg.repoUrl=repoUrl; saveConfig(cfg)
    const appRoot    = path.dirname(__dirname)
    const launchBat  = path.join(appRoot, 'LAUNCH.bat')
    const resultFile = path.join(__dirname, 'update-results.json')
    let rawBase = repoUrl.replace('github.com','raw.githubusercontent.com').replace(/\/+$/,'') + '/main'
    const FILES = [
      {repo:'app/renderer/modmaster.html',          local:path.join(__dirname,'renderer','modmaster.html')},
      {repo:'app/renderer/modmaster-create.html',   local:path.join(__dirname,'renderer','modmaster-create.html')},
      {repo:'app/renderer/modmaster-update.html',   local:path.join(__dirname,'renderer','modmaster-update.html')},
      {repo:'app/renderer/modmaster-rework.html',   local:path.join(__dirname,'renderer','modmaster-rework.html')},
      {repo:'app/renderer/modmaster-tools.html',    local:path.join(__dirname,'renderer','modmaster-tools.html')},
      {repo:'app/renderer/modmaster-account.html',  local:path.join(__dirname,'renderer','modmaster-account.html')},
      {repo:'app/renderer/modmaster-plans.html',    local:path.join(__dirname,'renderer','modmaster-plans.html')},
      {repo:'app/renderer/modmaster-hub.html',      local:path.join(__dirname,'renderer','modmaster-hub.html')},
      {repo:'app/renderer/modmaster-settings.html', local:path.join(__dirname,'renderer','modmaster-settings.html')},
      {repo:'app/renderer/sidebar.js',              local:path.join(__dirname,'renderer','sidebar.js')},
      {repo:'app/renderer/theme.js',                local:path.join(__dirname,'renderer','theme.js')},
      {repo:'app/renderer/game-selector.js',        local:path.join(__dirname,'renderer','game-selector.js')},
      {repo:'app/renderer/electron-bridge.js',      local:path.join(__dirname,'renderer','electron-bridge.js')},
      {repo:'app/renderer/tutorial.js',             local:path.join(__dirname,'renderer','tutorial.js')},
      {repo:'app/main.js',    local:path.join(__dirname,'main.js')},
      {repo:'app/preload.js', local:path.join(__dirname,'preload.js')},
    ]
    const relaunchBat = path.join(os.tmpdir(),'mm-relaunch.bat')
    fs.writeFileSync(relaunchBat, '@echo off\r\nstart "" "' + launchBat + '"\r\n')
    const fileLines = FILES.map(f => '  @{url="' + rawBase + '/' + f.repo + '"; dest="' + f.local.split('\\').join('/') + '"}').join(',\n')
    const psLines = [
      '$ErrorActionPreference="Continue"','$ProgressPreference="SilentlyContinue"',
      'Start-Sleep -Seconds 3','$files=@('+fileLines+')','$results=@()',
      'foreach($f in $files){$name=Split-Path $f.dest -Leaf;try{Invoke-WebRequest -Uri $f.url -OutFile $f.dest -UseBasicParsing -ErrorAction Stop;$results+=[PSCustomObject]@{file=$name;status="ok"}}catch{$results+=[PSCustomObject]@{file=$name;status="failed";error=$_.Exception.Message}}}',
      '$json=$results|ConvertTo-Json -Compress','Set-Content -Path "' + resultFile.split('\\').join('/') + '" -Value $json -Encoding UTF8',
      'Start-Sleep -Seconds 1','Start-Process "' + relaunchBat.split('\\').join('/') + '"'
    ]
    const scriptPath = path.join(os.tmpdir(),'modmaster-update.ps1')
    fs.writeFileSync(scriptPath, psLines.join('\n'), 'utf8')
    const {spawn} = require('child_process')
    spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Normal','-File',scriptPath],{detached:true,stdio:'ignore'}).unref()
    setTimeout(()=>app.quit(),800)
    return {success:true}
  } catch(e) { return {success:false,error:e.message} }
})

ipcMain.handle('get-update-results', async () => {
  const p = path.join(__dirname,'update-results.json')
  try { if(fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8')) } catch {}
  return null
})
ipcMain.handle('clear-update-results', async () => {
  try { fs.unlinkSync(path.join(__dirname,'update-results.json')) } catch {}
  return true
})
