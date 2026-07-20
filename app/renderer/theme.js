// theme.js v2 — ModMaster theme engine
// Handles: dark/light/custom modes, accent colors, publisher themes, background images
(function () {

  // ── Base modes ─────────────────────────────────────────────────────────────
  const MODES = {
    dark: {
      '--bg':'#0d0f12','--bg2':'#13161b','--bg3':'#1a1e25','--bg4':'#20252e',
      '--border':'rgba(255,255,255,0.07)','--border-hi':'rgba(255,255,255,0.18)',
      '--text':'#e8eaf0','--muted':'#6b7080','--faint':'#333845',
    },
    light: {
      '--bg':'#f0f2f5','--bg2':'#ffffff','--bg3':'#e8eaed','--bg4':'#dde0e5',
      '--border':'rgba(0,0,0,0.08)','--border-hi':'rgba(0,0,0,0.18)',
      '--text':'#1a1e25','--muted':'#7a8090','--faint':'#c8cad0',
    },
    midnight: {
      '--bg':'#050814','--bg2':'#080d1f','--bg3':'#0c1230','--bg4':'#11183d',
      '--border':'rgba(120,140,255,0.10)','--border-hi':'rgba(120,140,255,0.22)',
      '--text':'#ccd4ff','--muted':'#5060a0','--faint':'#1a2050',
    },
    forest: {
      '--bg':'#080f0a','--bg2':'#0d1810','--bg3':'#122016','--bg4':'#182b1d',
      '--border':'rgba(100,200,120,0.10)','--border-hi':'rgba(100,200,120,0.22)',
      '--text':'#c8e8cc','--muted':'#507060','--faint':'#1a3020',
    },
  }

  // ── Accent colors ──────────────────────────────────────────────────────────
  const ACCENTS = {
    default: { '--teal':'#2dd4a0','--purple':'#8b7cef','--coral':'#f07050','--pink':'#b23a5b','--amber':'#f5a623','--green':'#4ade80' },
    blue:    { '--teal':'#60a0f0','--purple':'#9070f0','--coral':'#50b0ff','--pink':'#70c0ff','--amber':'#f5a623','--green':'#4ade80' },
    green:   { '--teal':'#4ade80','--purple':'#2dd4a0','--coral':'#80e060','--pink':'#60d090','--amber':'#a0e030','--green':'#80ff60' },
    red:     { '--teal':'#f07050','--purple':'#e04060','--coral':'#ff6040','--pink':'#f05080','--amber':'#ff8020','--green':'#4ade80' },
    gold:    { '--teal':'#f5a623','--purple':'#e8c040','--coral':'#f08030','--pink':'#f0b040','--amber':'#ffd060','--green':'#a0d060' },
  }

  // ── Publisher themes ───────────────────────────────────────────────────────
  const PUBLISHERS = {
    rockstar:    { label:'Rockstar Games',  bg:'#0a0800', accent:'gold',    banner:'#c8a020', logo:'R*' },
    bethesda:    { label:'Bethesda',        bg:'#0a0c14', accent:'blue',    banner:'#4060b0', logo:'B'  },
    activision:  { label:'Activision',      bg:'#060810', accent:'blue',    banner:'#2040a0', logo:'A'  },
    ea:          { label:'EA Sports',       bg:'#030a08', accent:'green',   banner:'#1a8040', logo:'EA' },
    ubisoft:     { label:'Ubisoft',         bg:'#04060c', accent:'blue',    banner:'#1040c0', logo:'Ubi'},
    cdpr:        { label:'CD Projekt Red',  bg:'#0a0204', accent:'red',     banner:'#c01020', logo:'CDP'},
    mojang:      { label:'Mojang',          bg:'#040a04', accent:'green',   banner:'#206020', logo:'Moj'},
    capcom:      { label:'Capcom',          bg:'#0a0404', accent:'red',     banner:'#a01010', logo:'Cap'},
    bandai:      { label:'Bandai Namco',    bg:'#080608', accent:'default', banner:'#804090', logo:'BN' },
    paradox:     { label:'Paradox',         bg:'#060408', accent:'default', banner:'#603080', logo:'PDX'},
    none:        { label:'No theme',        bg:null,      accent:null,      banner:null,      logo:null },
  }

  // Game-to-publisher mapping
  const GAME_PUBLISHER = {
    'GTA V':'rockstar','RDR2':'rockstar','Skyrim SE':'bethesda','Skyrim VR':'bethesda',
    'Fallout 4':'bethesda','Cyberpunk 2077':'cdpr','Witcher 3':'cdpr',
    'Minecraft':'mojang','Stardew Valley':'none','Cities Skylines':'paradox',
    'Elden Ring':'bandai','Dark Souls III':'bandai','MH World':'capcom','Valheim':'none',
  }

  function hexToRgba(hex, alpha) {
    if (!hex?.startsWith('#')) return `rgba(100,100,100,${alpha})`
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  function applyVars(obj) {
    const root = document.documentElement
    Object.entries(obj).forEach(([k,v]) => root.style.setProperty(k,v))
  }

  function applyAccentDims(accent) {
    const a = ACCENTS[accent] || ACCENTS.default
    applyVars({
      '--teal-dim':   hexToRgba(a['--teal'],   0.12),
      '--teal-glow':  hexToRgba(a['--teal'],   0.25),
      '--purple-dim': hexToRgba(a['--purple'], 0.12),
      '--purple-glow':hexToRgba(a['--purple'], 0.25),
      '--coral-dim':  hexToRgba(a['--coral'],  0.12),
      '--pink-dim':   hexToRgba(a['--pink'],   0.12),
      '--amber-dim':  hexToRgba(a['--amber'],  0.12),
      '--green-dim':  hexToRgba(a['--green'],  0.12),
    })
  }

  // ── Background layer ───────────────────────────────────────────────────────
  function applyBackground(src, opacity, blur) {
    let layer = document.getElementById('mm-bg-layer')
    if (!layer) {
      layer = document.createElement('div')
      layer.id = 'mm-bg-layer'
      layer.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;transition:opacity 0.4s,filter 0.4s;'
      document.body.prepend(layer)
    }
    if (src) {
      layer.style.backgroundImage  = `url(${src})`
      layer.style.backgroundSize   = 'cover'
      layer.style.backgroundPosition = 'center'
      layer.style.opacity  = (opacity ?? 0.15)
      layer.style.filter   = blur ? `blur(${blur}px)` : 'none'
    } else {
      layer.style.opacity = '0'
    }
  }

  // ── Main apply function ────────────────────────────────────────────────────
  function applyTheme({ mode, accent, publisher, bgSrc, bgOpacity, bgBlur }) {
    const m = MODES[mode] || MODES.dark
    const a = ACCENTS[accent] || ACCENTS.default
    const p = publisher ? PUBLISHERS[publisher] : null

    // Apply base mode
    applyVars(m)

    // Apply accent
    applyVars(a)
    applyAccentDims(accent || 'default')

    // Apply publisher overrides
    if (p && p.bg) {
      document.documentElement.style.setProperty('--bg', p.bg)
      document.body.style.background = p.bg
    } else {
      document.body.style.background = 'var(--bg)'
    }
    if (p && p.accent && p.accent !== (accent || 'default')) {
      const pa = ACCENTS[p.accent] || {}
      applyVars(pa)
      applyAccentDims(p.accent)
    }

    // Apply background image
    applyBackground(bgSrc || null, bgOpacity, bgBlur)

    // Save
    const saved = { mode:mode||'dark', accent:accent||'default', publisher:publisher||null, bgSrc:bgSrc||null, bgOpacity:bgOpacity??0.15, bgBlur:bgBlur??0 }
    localStorage.setItem('mm-theme', JSON.stringify(saved))
    Object.assign(window.MMTheme, saved)
  }

  // ── Auto-switch by game ────────────────────────────────────────────────────
  function applyGameTheme(gameName) {
    const current = JSON.parse(localStorage.getItem('mm-theme') || '{}')
    const pub = GAME_PUBLISHER[gameName]
    if (pub && pub !== 'none') {
      applyTheme({ ...current, publisher: pub })
    }
  }

  // ── Load saved theme on startup ────────────────────────────────────────────
  const saved = JSON.parse(localStorage.getItem('mm-theme') || '{}')
  const defaults = { mode:'dark', accent:'default', publisher:null, bgSrc:null, bgOpacity:0.15, bgBlur:0 }
  const initial = { ...defaults, ...saved }

  window.MMTheme = { ...initial, apply: applyTheme, applyGameTheme, MODES, ACCENTS, PUBLISHERS, GAME_PUBLISHER }
  applyTheme(initial)

})()
