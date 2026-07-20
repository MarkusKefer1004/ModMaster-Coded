# Packaging ModMaster into a real .exe (Step 10)

This turns ModMaster into a genuine download‑and‑run app — **no `.bat` files and
no 80 MB Electron download for end users**. Electron is bundled inside the build.

## Build it (one step)
Double‑click **`BUILD.bat`**, or from a terminal:
```bash
npm install      # first run only (downloads Electron + electron-builder)
npm run dist     # build installer + portable exe
```
Output lands in **`dist\`**:
- **`ModMaster Setup 2.0.0.exe`** — installer (Start‑menu + desktop shortcut, choose install folder)
- **`ModMaster-Portable-2.0.0.exe`** — single file, double‑click to run, no install

Prefer an unpacked folder instead of installers? `npm run pack` → `dist\win-unpacked\ModMaster.exe`.

## Notes
- **Icon:** none set yet, so builds use Electron's default icon. To brand it, add
  `build/icon.ico` (256×256) and set `"win": { "icon": "build/icon.ico" }` in
  `package.json`.
- **Dev run is unchanged:** `START.bat` / `LAUNCH.bat` still work for day‑to‑day
  development (they run the downloaded Electron runtime against `app/`). The new
  root `package.json` is only used for building.
- **Code signing:** unsigned builds show a Windows SmartScreen warning on first
  run. To remove it you need a code‑signing certificate (configure under
  `build.win.certificateFile` / env vars). Optional, for later.
- **Auto‑updates:** the current in‑app updater (Settings) targets the `.bat` run
  model. For packaged builds, switch to `electron-updater` + a release feed later.
- The AI proxy in `server/` is **not** part of the app build — deploy it
  separately (see `server/README.md`).
