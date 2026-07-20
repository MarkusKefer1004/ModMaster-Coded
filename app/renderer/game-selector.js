// game-selector.js — ModMaster shared game selector
// Provides a dropdown with search + favourite star system
// Usage: MM_GameSelector.open(anchorEl, onSelect)
// Also exports: MM_GameSelector.getFavourites(), MM_GameSelector.toggleFav(id)

window.MM_GameSelector = (function () {

  // Demo games — replaced with real detected games at runtime
  const DEMO_GAMES = [
    {id:'gtav',     name:'GTA V',          version:'v1.68',  color:'#f07050', publisher:'Rockstar',     platform:'steam', mods:12},
    {id:'skyrim',   name:'Skyrim SE',       version:'AE 1.6', color:'#8b7cef', publisher:'Bethesda',     platform:'steam', mods:34},
    {id:'minecraft',name:'Minecraft',       version:'1.21',   color:'#4ade80', publisher:'Mojang',       platform:'other', mods:7},
    {id:'rdr2',     name:'RDR2',            version:'1.0.1491',color:'#f5a623',publisher:'Rockstar',     platform:'steam', mods:5},
    {id:'stardew',  name:'Stardew Valley',  version:'1.6',    color:'#2dd4a0', publisher:'ConcernedApe', platform:'steam', mods:3},
    {id:'cyberpunk',name:'Cyberpunk 2077',  version:'2.1',    color:'#60a0f0', publisher:'CDPR',         platform:'steam', mods:9},
  ]

  let allGames   = [...DEMO_GAMES]
  let favourites = []
  let dropdown   = null

  // ── Load real games + favourites ──────────────────────────────────────────
  async function loadData() {
    try {
      if (window.MM) {
        const detected = await window.MM.detectGames()
        if (detected?.length) {
          allGames = detected.map(g => ({
            id: g.name.toLowerCase().replace(/\s+/g,'-'),
            name: g.name, version: g.version || '',
            color: g.color || '#6b7080', publisher: g.publisher || '',
            platform: g.platform || 'steam', mods: 0, gamePath: g.gamePath, modPath: g.modPath,
          }))
        }
        favourites = await window.MM.getFavourites() || []
      } else {
        favourites = JSON.parse(localStorage.getItem('mm-favs') || '[]')
      }
      window._MMGames = allGames
    } catch(e) { console.log('game-selector loadData:', e) }
  }

  async function saveFavourites() {
    if (window.MM) await window.MM.setFavourites(favourites)
    else localStorage.setItem('mm-favs', JSON.stringify(favourites))
    // Refresh sidebar favs if sidebar is present
    if (window.MM_Sidebar) window.MM_Sidebar.renderFavs(false)
  }

  function isFav(id) { return favourites.includes(id) }

  async function toggleFav(id, e) {
    e?.stopPropagation()
    if (isFav(id)) favourites = favourites.filter(f => f !== id)
    else favourites.push(id)
    await saveFavourites()
    // Re-render dropdown if open
    if (dropdown) renderList(document.getElementById('mm-gs-search')?.value || '')
    // Re-render inline lists if present
    document.querySelectorAll('[data-game-id="'+id+'"] .mm-fav-star').forEach(el => {
      el.textContent = isFav(id) ? '★' : '☆'
      el.style.color = isFav(id) ? 'var(--amber,#f5a623)' : 'var(--muted)'
    })
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────
  function renderList(query) {
    const list = document.getElementById('mm-gs-list')
    if (!list) return
    const q = query.toLowerCase().trim()
    const favGames   = allGames.filter(g => isFav(g.id) && (!q || g.name.toLowerCase().includes(q)))
    const otherGames = allGames.filter(g => !isFav(g.id) && (!q || g.name.toLowerCase().includes(q)))
    const grouped = []
    if (favGames.length) {
      grouped.push('<div style="padding:4px 12px 2px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--amber,#f5a623);font-family:Rajdhani,sans-serif;font-weight:600;">★ Favourites</div>')
      grouped.push(...favGames.map(g => gameRow(g)))
    }
    if (otherGames.length) {
      if (favGames.length) grouped.push('<div style="height:0.5px;background:var(--border);margin:4px 0;"></div>')
      grouped.push(...otherGames.map(g => gameRow(g)))
    }
    if (!favGames.length && !otherGames.length) {
      grouped.push('<div style="padding:1rem;text-align:center;font-size:13px;color:var(--muted);">No games found</div>')
    }
    list.innerHTML = grouped.join('')
  }

  function gameRow(g) {
    const fav = isFav(g.id)
    return `<div data-game-id="${g.id}" onclick="MM_GameSelector._select('${g.id}')" style="
      display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;
      transition:background 0.15s;border-radius:8px;margin:0 4px;
    " onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
      <div style="width:8px;height:8px;border-radius:50%;background:${g.color};box-shadow:0 0 5px ${g.color};flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.name}</div>
        <div style="font-size:11px;color:var(--muted);">${g.version} ${g.platform ? '· '+g.platform : ''}</div>
      </div>
      <button class="mm-fav-star" onclick="MM_GameSelector.toggleFav('${g.id}',event)" style="
        background:none;border:none;cursor:pointer;font-size:16px;
        color:${fav?'var(--amber,#f5a623)':'var(--muted)'};padding:0;line-height:1;flex-shrink:0;
      " title="${fav?'Remove favourite':'Add to favourites'}">${fav?'★':'☆'}</button>
    </div>`
  }

  function open(anchorEl, onSelect) {
    close()
    window._MMGameSelectCallback = onSelect

    dropdown = document.createElement('div')
    dropdown.id = 'mm-gs-dropdown'
    dropdown.style.cssText = `
      position:fixed;z-index:2000;
      background:var(--bg2);border:0.5px solid var(--border-hi,rgba(255,255,255,0.15));
      border-radius:12px;width:280px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      overflow:hidden;
      animation:gsIn 0.15s ease forwards;
    `

    if (!document.getElementById('mm-gs-style')) {
      const s = document.createElement('style')
      s.id = 'mm-gs-style'
      s.textContent = '@keyframes gsIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}'
      document.head.appendChild(s)
    }

    dropdown.innerHTML = `
      <div style="padding:10px 12px 6px;">
        <div style="display:flex;align-items:center;gap:8px;background:var(--bg3);border:0.5px solid var(--border);border-radius:8px;padding:6px 10px;">
          <span style="color:var(--muted);font-size:14px;">🔍</span>
          <input id="mm-gs-search" placeholder="Search games..." autofocus style="
            background:none;border:none;outline:none;color:var(--text);
            font-family:'DM Sans',sans-serif;font-size:13px;width:100%;
          " oninput="MM_GameSelector._renderList(this.value)">
        </div>
      </div>
      <div id="mm-gs-list" style="max-height:280px;overflow-y:auto;padding-bottom:8px;"></div>
      <div style="padding:8px 12px;border-top:0.5px solid var(--border);">
        <button onclick="MM_GameSelector._browse()" style="
          width:100%;padding:7px;background:var(--bg3);border:0.5px solid var(--border);
          border-radius:8px;color:var(--muted);font-family:Rajdhani,sans-serif;
          font-size:0.8rem;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;
          transition:border-color 0.2s,color 0.2s;
        " onmouseover="this.style.borderColor='var(--border-hi)';this.style.color='var(--text)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
          📁 Browse folder manually
        </button>
      </div>
    `

    // Position near anchor
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect()
      const top  = rect.bottom + 6
      const left = Math.min(rect.left, window.innerWidth - 290)
      dropdown.style.top  = top  + 'px'
      dropdown.style.left = left + 'px'
    } else {
      dropdown.style.top  = '50%'
      dropdown.style.left = '50%'
      dropdown.style.transform = 'translate(-50%,-50%)'
    }

    document.body.appendChild(dropdown)
    renderList('')
    setTimeout(() => document.getElementById('mm-gs-search')?.focus(), 50)

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('mousedown', _outsideClick)
    }, 100)
  }

  function _outsideClick(e) {
    if (dropdown && !dropdown.contains(e.target)) close()
  }

  function close() {
    dropdown?.remove()
    dropdown = null
    document.removeEventListener('mousedown', _outsideClick)
  }

  function _select(id) {
    const game = allGames.find(g => g.id === id)
    close()
    if (game && window._MMGameSelectCallback) {
      window._MMGameSelectCallback(game)
      // Apply publisher theme
      if (window.MMTheme) window.MMTheme.applyGameTheme(game.name)
    }
  }

  async function _browse() {
    close()
    if (window.MM) {
      const folder = await window.MM.browseFolder()
      if (folder) {
        const name = folder.split(/[/\\]/).pop() || 'Custom game'
        const game = { id:'custom-'+Date.now(), name, version:'', color:'#8b7cef', publisher:'', platform:'manual', gamePath:folder, modPath:folder }
        if (window._MMGameSelectCallback) window._MMGameSelectCallback(game)
      }
    }
  }

  // Auto-load data
  document.addEventListener('DOMContentLoaded', loadData)

  return {
    open, close, toggleFav, isFav, loadData,
    getAll: () => allGames,
    getFavourites: () => favourites,
    _select, _browse, _renderList: renderList,
  }
})()
