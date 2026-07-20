// electron-bridge.js v2
// Patches window.fetch for Anthropic API calls when running in Electron.
// Gracefully does nothing in a plain browser.
(function () {
  if (!window.MM) return

  // Patch fetch → route Anthropic calls through secure main process
  const _fetch = window.fetch.bind(window)
  window.fetch = async function (url, opts) {
    if (typeof url === 'string' && url.includes('api.anthropic.com')) {
      let body
      try { body = JSON.parse(opts?.body || '{}') } catch { body = {} }
      const result = await window.MM.anthropic(body)
      return { ok: !result?.error, status: result?.error ? 500 : 200,
               json: async () => result, text: async () => JSON.stringify(result) }
    }
    return _fetch(url, opts)
  }

  // Real folder browse
  window.nativeBrowseFolder = () => window.MM.browseFolder()

  // Real scan
  window.nativeScanFolder = (p) => window.MM.scanFolder(p)

  // Real game detection
  window.nativeDetectGames = () => window.MM.detectGames()

  // Flag
  window.isElectronApp = true
  document.dispatchEvent(new Event('electron-ready'))
})()
