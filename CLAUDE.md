# ModMaster — Universal Mod Platform
## Context for Claude Code — read this entire file before doing anything

---

## What this is

A Windows desktop app (Electron v28) that lets casual gamers create, fix, rework and manage mods for any game without coding. Target user: knows what mods are, can't write code. Designed for short attention spans — plug and play, progress bars on everything, minimal visual noise, simple by default with detail on demand.

---

## Build status

| Step | Feature | Status |
|------|---------|--------|
| 1 | App shell + game detection | ✅ Done |
| 2 | Create Mods (AI + templates + textures) | ✅ Done |
| 3 | Update Mods + Steam Workshop tab | ✅ Done |
| 4 | Rework Mods | ⏳ **Build this next** |
| 5 | Tool Installer (UE4SS etc.) | ⏳ Pending |
| 6 | User accounts | ⏳ Pending |
| 7 | Community Hub | ⏳ Pending |
| 8 | AI proxy + payments | ⏳ Pending |

---

## Folder structure

```
ModMaster/
├── CLAUDE.md                     ← this file
├── LAUNCH.bat                    ← everyday launcher
├── START.bat / FIX-ELECTRON.bat / DEBUG.bat / UPDATER.bat
├── electron/                     ← DO NOT TOUCH, NOT in GitHub
└── app/
    ├── main.js                   ← Electron main process (Node.js, ~690 lines)
    ├── preload.js                 ← IPC bridge (~51 lines)
    ├── package.json               ← {"name":"modmaster","version":"2.0.0","main":"main.js"}
    └── renderer/                 ← ALL UI — pure vanilla HTML/CSS/JS, no bundler
        ├── modmaster.html         ← main screen (469 lines)
        ├── modmaster-create.html  ← Step 2 done (659 lines)
        ├── modmaster-update.html  ← Step 3 done (634 lines)
        ├── modmaster-rework.html  ← PLACEHOLDER — replace with Step 4
        ├── modmaster-tools.html   ← PLACEHOLDER — replace with Step 5
        ├── modmaster-hub.html     ← PLACEHOLDER — replace with Step 7
        ├── modmaster-settings.html← working settings page (359 lines)
        ├── theme.js               ← theme engine (158 lines)
        ├── sidebar.js             ← collapsible nav (152 lines)
        ├── game-selector.js       ← game picker dropdown (221 lines)
        ├── tutorial.js            ← first-launch tutorial overlay
        └── electron-bridge.js     ← patches fetch for Anthropic API
```

---

## CRITICAL RULES — never break these

1. **No npm packages in renderer** — pure vanilla JS/HTML/CSS only. No React, Vue, bundler, or CDN libs.
2. **All backend calls go via `window.MM.*`** — never use `require()` in renderer files.
3. **Every `window.MM` call needs a demo fallback** — `if (window.MM) { ... } else { demoFallback() }` — renders must work in browser preview too.
4. **Electron v28, frame:false** — custom titlebar on every page, minWidth:960, minHeight:640.
5. **Close → tray** — `window-close` hides the window, does NOT quit. Quit is via tray menu only.
6. **Script load order on every feature page:**
   ```html
   <script src="theme.js"></script>
   <script src="game-selector.js"></script>
   <script src="sidebar.js"></script>
   <script src="electron-bridge.js"></script>
   ```

---

## Complete preload.js (copy exactly, do not modify)

```javascript
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
  createModFolder:(p)  => ipcRenderer.invoke('create-mod-folder', p),
  readFile:     (p)   => ipcRenderer.invoke('read-file', p),
  saveFile:  (opts)   => ipcRenderer.invoke('save-file', opts),
  installMod: (opts)  => ipcRenderer.invoke('install-mod', opts),

  // Steam Workshop
  scanWorkshop:  (appId) => ipcRenderer.invoke('scan-workshop', appId),
  scanWorkshopAll:   ()  => ipcRenderer.invoke('scan-workshop-all'),

  // Self-updater
  updateAndRestart: (opts) => ipcRenderer.invoke('update-and-restart', opts),
  getUpdateResults:    ()  => ipcRenderer.invoke('get-update-results'),
  clearUpdateResults:  ()  => ipcRenderer.invoke('clear-update-results'),

  platform: process.platform,
})
```

---

## Standard page template (copy this for every new screen)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>ModMaster — Page Name</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="theme.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;overflow:hidden;}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--faint,#333845) 1px,transparent 1px),linear-gradient(90deg,var(--faint,#333845) 1px,transparent 1px);background-size:40px 40px;opacity:0.15;pointer-events:none;z-index:0;}

/* Custom titlebar */
#titlebar{position:fixed;top:0;left:0;right:0;height:40px;background:var(--bg2);border-bottom:0.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;z-index:300;-webkit-app-region:drag;user-select:none;}
#titlebar-left{display:flex;align-items:center;gap:10px;padding:0 14px;}
#titlebar-logo{font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;background:linear-gradient(90deg,var(--text) 50%,var(--teal,#2dd4a0));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
#titlebar-controls{display:flex;-webkit-app-region:no-drag;}
.tb-btn{width:46px;height:40px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--muted);font-size:12px;transition:background 0.15s,color 0.15s;}
.tb-btn:hover{background:var(--bg3);color:var(--text);}
#tb-close:hover{background:#c42b2b;color:#fff;}

/* Main content */
#mm-main-content{position:fixed;top:40px;left:0;right:0;bottom:0;overflow-y:auto;padding:1.75rem 2rem 3rem;z-index:1;}

/* Common components */
.back-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:0.5px solid var(--border);border-radius:9px;padding:6px 12px;color:var(--muted);font-family:'Rajdhani',sans-serif;font-size:0.8rem;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;transition:all 0.2s;margin-bottom:1.5rem;}
.back-btn:hover{border-color:var(--border-hi);color:var(--text);}
.game-badge{display:inline-flex;align-items:center;gap:6px;background:var(--bg3);border:0.5px solid var(--border);border-radius:99px;padding:4px 12px 4px 8px;font-size:12px;color:var(--muted);cursor:pointer;transition:border-color 0.2s;}
.game-badge:hover{border-color:var(--border-hi);}
.game-dot{width:7px;height:7px;border-radius:50%;}
.page-title{font-family:'Rajdhani',sans-serif;font-size:1.6rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:linear-gradient(90deg,var(--text) 50%,var(--ACCENT,#2dd4a0));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:4px;}
.page-sub{font-size:12px;color:var(--muted);margin-bottom:1.75rem;}
.panel{display:none;max-width:660px;}
.panel.active{display:block;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fade-in{animation:fadeUp 0.3s ease forwards;}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.15);border-top-color:currentColor;animation:spin 0.7s linear infinite;display:inline-block;flex-shrink:0;}
</style>
</head>
<body>

<div id="titlebar">
  <div id="titlebar-left"><span id="titlebar-logo">ModMaster</span></div>
  <div id="titlebar-controls">
    <button class="tb-btn" onclick="window.MM?.minimize()">&#x2014;</button>
    <button class="tb-btn" id="tb-close" onclick="window.MM?.close()">&#x2715;</button>
  </div>
</div>

<div id="mm-main-content">
  <!-- Top nav row — always first -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;" class="fade-in">
    <button class="back-btn" onclick="goBack()">← Back</button>
    <div id="game-badge-wrap"></div>
  </div>

  <div class="page-title fade-in" style="animation-delay:0.05s;opacity:0;">Page Title</div>
  <div class="page-sub fade-in" style="animation-delay:0.08s;opacity:0;" id="page-sub">Subtitle</div>

  <!-- Steps shown/hidden via JS -->
  <div id="step-game" class="panel active">
    <!-- game picker prompt -->
  </div>
  <div id="step-main" class="panel">
    <!-- main content -->
  </div>
</div>

<script src="game-selector.js"></script>
<script src="electron-bridge.js"></script>
<script>
const STEPS = ['game','main']
function show(s){ STEPS.forEach(id=>{ const el=document.getElementById('step-'+id); if(el) el.classList.toggle('active',id===s) }) }
function goBack(){ window.location.href='modmaster.html' }

function openGamePicker(){
  showGamePicker(function(game){
    // game = { id, name, color, publisher, platform, gamePath, modPath, appId }
    document.getElementById('game-badge-wrap').innerHTML = `
      <div class="game-badge" onclick="openGamePicker()">
        <div class="game-dot" style="background:${game.color};box-shadow:0 0 5px ${game.color};"></div>
        ${game.name}<span style="color:var(--muted);font-size:10px;margin-left:2px;">▾</span>
      </div>`
    localStorage.setItem('mm-active-game', JSON.stringify(game))
    if(window.MMTheme) window.MMTheme.applyGameTheme(game.name)
    show('main')
  })
}

document.addEventListener('DOMContentLoaded', function(){
  try {
    const saved = JSON.parse(localStorage.getItem('mm-active-game')||'null')
    if(saved){ openGamePicker_restore(saved) }
  } catch {}
})
</script>
</body>
</html>
```

---

## CSS design tokens

All pages use these CSS variables (set by theme.js):

```
Backgrounds:    --bg  --bg2  --bg3  --bg4
Borders:        --border  --border-hi
Text:           --text  --muted  --faint
Accent colours: --teal  --purple  --coral  --pink  --amber  --green
Dim variants:   --teal-dim  --purple-dim  --coral-dim  --pink-dim  --amber-dim  --green-dim
Glow variants:  --teal-glow  --purple-glow
```

Default values (dark mode):
```
--bg: #0d0f12    --bg2: #13161b    --bg3: #1a1e25    --bg4: #20252e
--border: rgba(255,255,255,0.07)   --border-hi: rgba(255,255,255,0.18)
--text: #e8eaf0  --muted: #6b7080  --faint: #333845
--teal: #2dd4a0  --purple: #8b7cef  --coral: #f07050
--pink: #e06090  --amber: #f5a623  --green: #4ade80
```

Feature colour assignment:
- Create Mods → `var(--teal, #2dd4a0)`
- Update Mods → `var(--purple, #8b7cef)`
- Rework Mods → `var(--pink, #e06090)`
- Tool Installer → `var(--amber, #f5a623)`

---

## Fonts

```
'Rajdhani'     → headings, labels, buttons, badges (font-weight:600/700, text-transform:uppercase, letter-spacing:0.04–0.1em)
'DM Sans'      → body text, descriptions (font-weight:300/400/500)
'DM Mono'      → code values, IDs, paths (font-size:11-13px)
```

---

## Game object structure

`detectGames()` and `showGamePicker()` return game objects with this shape:

```javascript
{
  id:               'gtav',           // slug — lowercase, hyphens
  name:             'GTA V',          // display name
  folderName:       'Grand Theft Auto V',
  gamePath:         'D:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V',
  modPath:          'D:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V\\scripts',
  modFolderExists:  true,
  color:            '#f07050',        // accent colour for this game
  publisher:        'Rockstar',
  platform:         'steam',          // 'steam' | 'epic' | 'xbox' | 'gog' | 'other'
  appId:            '271590',         // Steam App ID if known
  isXbox:           false,
}
```

---

## Making an Anthropic API call from renderer

```javascript
async function callAI(prompt, systemPrompt) {
  const key = window.MM ? await window.MM.getApiKey() : localStorage.getItem('mm-api-key')
  if (!key) return null  // no key → demo mode

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await resp.json()
  return data?.content?.[0]?.text || null
}
// Note: electron-bridge.js patches fetch so API calls go through main.js
// This means the actual HTTP request is made in Node.js (no CORS issues)
```

---

## Step 4 spec — Rework Mods (build this next)

Replace `modmaster-rework.html` (currently a placeholder) with a full implementation.

### Flow
1. **Game picker** → auto-loads if `localStorage('mm-active-game')` exists
2. **Mod list** → scan `game.modPath` with `MM.scanFolder()`, show all mods as cards
3. **Mod editor** → click a mod to open editor
4. **Save** → saves as new version, never overwrites original

### Editor — 3 layers of progressive disclosure

**Layer 1 — Simple (always visible):**
- Sliders for numeric values (speed x1→x5, money amounts etc.)
- Radio buttons for preset options (x2 / x3 / x5 / custom)
- On/Off toggles per effect

**Layer 2 — Detail (expand button):**
- Exact number input fields with +/- buttons
- Dropdown with common presets + "type exact value"
- Unit labels (%, x, $, m/s etc.)

**Layer 3 — Code (collapsed accordion):**
- Raw code view in DM Mono font
- Syntax-highlighted textarea (no external libs — basic highlighting only)
- Warning: "Editing code directly may break the mod"

### Properties grouped by category

Each category is a collapsible section. Inside: visual cards per effect.

```
📊 Player        → health, armor, stamina, speed, jump, carry weight
🔫 Weapons       → damage, ammo, fire rate, range
💰 Economy       → money, prices, drop rates
🌍 World         → weather, time, spawn rates
👁 Visual        → FOV, effects, draw distance
⚙ Other         → anything that doesn't fit above
```

### Version history

- On save: prompt for label (placeholder: auto-date like "Jul 20 14:32")
- Version list shown as cards: label + date + "Restore" button
- Max 10 versions per mod, oldest deleted when limit hit
- Stored in `localStorage('mm-versions-{modId}')` as JSON array

### Result screen (after saving)

Same pattern as Create Mods:
- Mod name (editable inline)
- Effects list (what changed vs original)
- Install / Download / "Rework again" buttons
- "Not happy? Keep editing" button → goes back to editor

### Key UX rules for this screen

- Progress bar while scanning mod folder
- Never show raw file paths to the user
- Unknown/unrecognised mod files → show generic "Custom mod" card, still allow editing
- If mod folder is empty → friendly empty state with link to Create Mods

---

## Step 5 spec — Tool Installer

Replace `modmaster-tools.html` with full implementation.

### Tools to support

| Tool | Games | Engine |
|------|-------|--------|
| UE4SS | Any Unreal Engine game | Unreal Engine 4/5 |
| ScriptHookV | GTA V | RAGE |
| ScriptHookRDR2 | RDR2 | RAGE |
| OpenIV | GTA V, GTA IV | RAGE |
| SMAPI | Stardew Valley | MonoGame |
| BepInEx | Unity games | Unity |
| F4SE | Fallout 4 | Creation Engine |
| SKSE64 | Skyrim SE | Creation Engine |

### Flow

1. Select game → auto-detect which tool is needed
2. Show recommended tool(s) with one-liner description
3. Warn if game needs multiple tools (compatibility note)
4. Confirm → download + install with progress bar
5. Xbox Game Pass special path:
   - Step a: warn it may be harder
   - Step b: guided permission setup (with skip option)
   - Step c: auto-install

### Xbox Game Pass permission fix

Games in `C:\XboxGames\` are accessible — install directly.
Games in `C:\Program Files\WindowsApps\` are locked — need to:
1. Take ownership via PowerShell (run as admin)
2. Grant full control to current user
3. Then install mod tool

ModMaster runs the PowerShell commands via `main.js` using `child_process.execSync`.

---

## GitHub / deployment info

- Private GitHub repo
- PC1 pushes → PC2 pulls via GitHub Desktop (Fetch → Pull)
- In-app auto-updater in Settings → pastes GitHub URL with token → "Update and restart"
- App closes → PowerShell script downloads files from GitHub raw URLs → relaunches via LAUNCH.bat → shows results banner in Settings
- `.gitignore`: `electron/`, `node_modules/`, `*.tmp`, `update-results.json`
- **DO NOT push `electron/` folder** — it's 80MB, GitHub rejects it, START.bat downloads it automatically

---

## Known gotchas

- `package.json` saves as PDF on some Windows machines — always deliver as forced Blob download
- `window.MM` is undefined in browser — guard every call: `if (window.MM) { ... } else { demo() }`
- Steam Workshop folder names are numbers (AppIDs/ModIDs) — use `scanWorkshopAll()` to resolve names via Steam Store API
- Xbox Game Pass game titles are in `MicrosoftGameConfig.mgc` inside each game folder
- After `update-and-restart`, app relaunches via `LAUNCH.bat`, not `electron.exe` directly (path with spaces issue)
- Merge conflicts in main.js were a problem — always provide complete clean file replacements
- `showGamePicker(callback)` is a global defined at bottom of `game-selector.js` — wraps `MM_GameSelector.open()`
