const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron')
const path = require('path')
const fs   = require('fs')
const https = require('https')
const http  = require('http')
const os   = require('os')

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'modmaster-config.json')
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')) } catch { return {} } }
function saveConfig(d) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(d,null,2),'utf8') }

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

// ── Favourite games ──────────────────────────────────────────────────────────
ipcMain.handle('get-favourites', () => loadConfig().favourites || [])
ipcMain.handle('set-favourites', (e, ids) => { const c=loadConfig(); c.favourites=ids; saveConfig(c); return true })

// ── User settings (theme, background etc.) ───────────────────────────────────
ipcMain.handle('get-settings', () => loadConfig().settings || {})
ipcMain.handle('set-settings', (e, s) => { const c=loadConfig(); c.settings={...c.settings,...s}; saveConfig(c); return true })

// ── Anthropic API ────────────────────────────────────────────────────────────
ipcMain.handle('anthropic-request', async (e, body) => {
  const key = loadConfig().apiKey || ''
  if (!key) return { error: 'no_api_key', message: 'No API key — go to Settings to add yours.' }
  return new Promise((resolve) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(payload),
                 'x-api-key':key, 'anthropic-version':'2023-06-01' }
    }, (res) => {
      let d=''
      res.on('data', c => d+=c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({error:'parse_error'}) } })
    })
    req.on('error', err => resolve({error:'network_error',message:err.message}))
    req.write(payload); req.end()
  })
})

// ── Browse for folder ────────────────────────────────────────────────────────
ipcMain.handle('browse-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title:'Select game folder', properties:['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
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

// ── Detect installed games ───────────────────────────────────────────────────
ipcMain.handle('detect-games', async () => {
  const detected = []
  const STEAM_PATHS = [
    'C:\\Program Files (x86)\\Steam\\steamapps\\common',
    'C:\\Program Files\\Steam\\steamapps\\common',
    'D:\\Steam\\steamapps\\common', 'D:\\SteamLibrary\\steamapps\\common',
    'E:\\Steam\\steamapps\\common', 'E:\\SteamLibrary\\steamapps\\common',
    'F:\\Steam\\steamapps\\common', 'F:\\SteamLibrary\\steamapps\\common',
  ]
  const EPIC_PATHS  = ['C:\\Program Files\\Epic Games','D:\\Epic Games','E:\\Epic Games']
  const XBOX_PATHS  = ['C:\\XboxGames','D:\\XboxGames','E:\\XboxGames',
                       'C:\\Program Files\\WindowsApps']
  const GOG_PATHS   = ['C:\\GOG Games','C:\\Program Files (x86)\\GOG Galaxy\\Games','D:\\GOG Games']

  const KNOWN = {
    'Grand Theft Auto V':           {name:'GTA V',          color:'#f07050',modFolder:'scripts',    publisher:'Rockstar',appId:'271590'},
    'Skyrim Special Edition':       {name:'Skyrim SE',       color:'#8b7cef',modFolder:'Data',       publisher:'Bethesda', appId:'489830'},
    'SkyrimVR':                     {name:'Skyrim VR',       color:'#8b7cef',modFolder:'Data',       publisher:'Bethesda', appId:'611670'},
    'Minecraft':                    {name:'Minecraft',       color:'#4ade80',modFolder:'mods',       publisher:'Mojang',   appId:null},
    'Red Dead Redemption 2':        {name:'RDR2',            color:'#f5a623',modFolder:'lml',        publisher:'Rockstar', appId:'1174180'},
    'Stardew Valley':               {name:'Stardew Valley',  color:'#2dd4a0',modFolder:'Mods',       publisher:'ConcernedApe',appId:'413150'},
    'Cyberpunk 2077':               {name:'Cyberpunk 2077',  color:'#60a0f0',modFolder:'mods',       publisher:'CDPR',     appId:'1091500'},
    'Cities Skylines II':           {name:'Cities Skylines', color:'#e06090',modFolder:'Mods',       publisher:'Paradox',  appId:'949230'},
    'Elden Ring':                   {name:'Elden Ring',      color:'#f5a623',modFolder:'mods',       publisher:'Bandai',   appId:'1245620'},
    'Dark Souls III':               {name:'Dark Souls III',  color:'#888780',modFolder:'mods',       publisher:'Bandai',   appId:'374320'},
    'Fallout 4':                    {name:'Fallout 4',       color:'#b8e050',modFolder:'Data',       publisher:'Bethesda', appId:'377160'},
    'The Witcher 3':                {name:'Witcher 3',       color:'#c0a060',modFolder:'Mods',       publisher:'CDPR',     appId:'292030'},
    'Monster Hunter World':         {name:'MH World',        color:'#f07850',modFolder:'nativePC',   publisher:'Capcom',   appId:'582010'},
    'Valheim':                      {name:'Valheim',         color:'#6090a0',modFolder:'BepInEx',    publisher:'IronGate', appId:'892970'},
    'RimWorld':                     {name:'RimWorld',        color:'#d09060',modFolder:'Mods',       publisher:'Ludeon',   appId:'294100'},
  }

  function checkBase(base, platform) {
    let entries; try { entries = fs.readdirSync(base,{withFileTypes:true}) } catch { return }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const info = KNOWN[e.name]
      if (info) {
        const gamePath = path.join(base, e.name)
        const modPath  = path.join(gamePath, info.modFolder)
        detected.push({ id: info.name.toLowerCase().replace(/\s/g,'-'),
          name:info.name, folderName:e.name, gamePath, publisher:info.publisher,
          modPath: fs.existsSync(modPath) ? modPath : gamePath,
          modFolderExists: fs.existsSync(modPath),
          color:info.color, platform, appId:info.appId })
      }
    }
  }

  STEAM_PATHS.forEach(p => checkBase(p, 'steam'))
  EPIC_PATHS.forEach(p  => checkBase(p, 'epic'))
  XBOX_PATHS.forEach(p  => checkBase(p, 'xbox'))
  GOG_PATHS.forEach(p   => checkBase(p, 'gog'))

  const seen = new Set()
  return detected.filter(g => { if(seen.has(g.name)) return false; seen.add(g.name); return true })
})

// ── Create mod folder ────────────────────────────────────────────────────────
ipcMain.handle('create-mod-folder', async (e, folderPath) => {
  try { fs.mkdirSync(folderPath,{recursive:true}); return {success:true} }
  catch(err) { return {success:false,error:err.message} }
})

// ── Read / write files ───────────────────────────────────────────────────────
ipcMain.handle('read-file',  async (e, p) => { try { return {success:true,content:fs.readFileSync(p,'utf8')} } catch(err) { return {success:false,error:err.message} } })
ipcMain.handle('save-file',  async (e, {filePath,content}) => { try { fs.writeFileSync(filePath,content,'utf8'); return {success:true} } catch(err) { return {success:false,error:err.message} } })

// ── Install mod (copy file into game folder) ─────────────────────────────────
ipcMain.handle('install-mod', async (e, {sourcePath,gamePath}) => {
  try { fs.copyFileSync(sourcePath, path.join(gamePath,path.basename(sourcePath))); return {success:true} }
  catch(err) { return {success:false,error:err.message} }
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
