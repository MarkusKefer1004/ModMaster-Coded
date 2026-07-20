// sidebar.js — ModMaster shared sidebar navigation
// Include on every feature page. Call MM_Sidebar.init() on DOMContentLoaded.

window.MM_Sidebar = (function () {

  const LINKS = [
    { id:'home',    label:'Home',          icon:'🏠', href:'modmaster.html' },
    { id:'create',  label:'Create Mods',   icon:'✨', href:'modmaster-create.html' },
    { id:'update',  label:'Update Mods',   icon:'🔄', href:'modmaster-update.html' },
    { id:'rework',  label:'Rework Mods',   icon:'✏️', href:'modmaster-rework.html' },
    { id:'tools',   label:'Tool Installer',icon:'🔧', href:'modmaster-tools.html' },
    { id:'hub',     label:'Community Hub', icon:'🌐', href:'modmaster-hub.html' },
  ]

  function getActive() {
    const page = window.location.pathname.split('/').pop()
    const found = LINKS.find(l => l.href === page)
    return found ? found.id : 'home'
  }

  function buildHTML(collapsed) {
    const active = getActive()
    const w = collapsed ? '56px' : '200px'
    return `
<nav id="mm-sidebar" style="
  position:fixed; left:0; top:0; bottom:0; width:${w};
  background:var(--bg2); border-right:0.5px solid var(--border);
  display:flex; flex-direction:column; z-index:200;
  transition:width 0.25s ease; overflow:hidden;
" role="navigation" aria-label="Main navigation">

  <!-- Logo / collapse button -->
  <div style="display:flex;align-items:center;justify-content:${collapsed?'center':'space-between'};padding:${collapsed?'16px 0':'14px 14px 14px 16px'};border-bottom:0.5px solid var(--border);min-height:54px;cursor:pointer;" onclick="MM_Sidebar.toggle()" title="${collapsed?'Expand sidebar':'Collapse sidebar'}">
    ${collapsed ? '' : '<span style="font-family:Rajdhani,sans-serif;font-size:1.1rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text);">ModMaster</span>'}
    <div style="width:28px;height:28px;border-radius:8px;background:var(--bg3);border:0.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);transition:transform 0.25s;" id="mm-sidebar-toggle-icon">${collapsed?'▶':'◀'}</div>
  </div>

  <!-- Nav links -->
  <div style="flex:1;padding:8px 0;overflow-y:auto;overflow-x:hidden;">
    ${LINKS.map(l => {
      const isActive = l.id === active
      return `<a href="${l.href}" style="
        display:flex;align-items:center;gap:10px;
        padding:${collapsed?'10px 0':'9px 14px 9px 16px'};
        justify-content:${collapsed?'center':'flex-start'};
        text-decoration:none;
        background:${isActive?'var(--teal-dim,rgba(45,212,160,0.1))':'transparent'};
        border-left:${isActive?'2px solid var(--teal,#2dd4a0)':'2px solid transparent'};
        color:${isActive?'var(--teal,#2dd4a0)':'var(--muted)'};
        font-family:Rajdhani,sans-serif;font-size:0.9rem;font-weight:600;
        letter-spacing:0.05em;text-transform:uppercase;
        transition:background 0.15s,color 0.15s;white-space:nowrap;
      " onmouseover="if(!${isActive})this.style.background='var(--bg3)';this.style.color='var(--text)';" onmouseout="if(!${isActive})this.style.background='transparent';this.style.color='${isActive?'var(--teal,#2dd4a0)':'var(--muted)'}';" title="${l.label}">
        <span style="font-size:16px;flex-shrink:0;">${l.icon}</span>
        ${collapsed?'':'<span>'+l.label+'</span>'}
      </a>`
    }).join('')}
  </div>

  <!-- Favourite games section -->
  <div id="mm-sidebar-favs" style="border-top:0.5px solid var(--border);padding:8px 0;">
    ${collapsed ? '' : '<div style="padding:6px 16px 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);font-family:Rajdhani,sans-serif;font-weight:600;">Favourites</div>'}
    <div id="mm-fav-list"></div>
  </div>

  <!-- Bottom: Settings -->
  <div style="border-top:0.5px solid var(--border);padding:8px 0;">
    <a href="modmaster-settings.html" style="
      display:flex;align-items:center;gap:10px;
      padding:${collapsed?'10px 0':'9px 14px 9px 16px'};
      justify-content:${collapsed?'center':'flex-start'};
      text-decoration:none;color:var(--muted);
      font-family:Rajdhani,sans-serif;font-size:0.9rem;font-weight:600;
      letter-spacing:0.05em;text-transform:uppercase;
      transition:background 0.15s,color 0.15s;white-space:nowrap;
    " onmouseover="this.style.background='var(--bg3)';this.style.color='var(--text)';" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';" title="Settings">
      <span style="font-size:16px;flex-shrink:0;">⚙️</span>
      ${collapsed?'':'<span>Settings</span>'}
    </a>
  </div>

</nav>

<!-- Content offset -->
<div id="mm-sidebar-offset" style="margin-left:${w};transition:margin-left 0.25s ease;"></div>
`
  }

  async function renderFavs(collapsed) {
    const favList = document.getElementById('mm-fav-list')
    if (!favList) return
    let favIds = []
    try { favIds = window.MM ? await window.MM.getFavourites() : JSON.parse(localStorage.getItem('mm-favs')||'[]') } catch {}
    const allGames = window._MMGames || []
    const favGames = allGames.filter(g => favIds.includes(g.id))
    if (!favGames.length) {
      favList.innerHTML = collapsed ? '' : '<div style="padding:4px 16px;font-size:11px;color:var(--muted);opacity:0.6;">No favourites yet</div>'
      return
    }
    favList.innerHTML = favGames.map(g => `
      <div onclick="window.location.href='modmaster-create.html?game=${g.id}'" style="
        display:flex;align-items:center;gap:8px;
        padding:${collapsed?'8px 0':'7px 14px 7px 16px'};
        justify-content:${collapsed?'center':'flex-start'};
        cursor:pointer;color:var(--muted);
        font-family:Rajdhani,sans-serif;font-size:0.85rem;font-weight:600;
        letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap;
        transition:background 0.15s,color 0.15s;
      " onmouseover="this.style.background='var(--bg3)';this.style.color='var(--text)';" onmouseout="this.style.background='transparent';this.style.color='var(--muted)';" title="${g.name}">
        <div style="width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0;box-shadow:0 0 5px ${g.color};"></div>
        ${collapsed?'':'<span style="overflow:hidden;text-overflow:ellipsis;">'+g.name+'</span>'}
      </div>`).join('')
  }

  let isCollapsed = JSON.parse(localStorage.getItem('mm-sidebar-collapsed')||'false')

  function init() {
    const container = document.createElement('div')
    container.innerHTML = buildHTML(isCollapsed)
    document.body.prepend(...container.childNodes)

    // Offset main content
    const mainContent = document.getElementById('mm-main-content') || document.querySelector('.app')
    if (mainContent) {
      mainContent.style.marginLeft = isCollapsed ? '56px' : '200px'
      mainContent.style.transition = 'margin-left 0.25s ease'
    }

    renderFavs(isCollapsed)
  }

  function toggle() {
    isCollapsed = !isCollapsed
    localStorage.setItem('mm-sidebar-collapsed', JSON.stringify(isCollapsed))
    const sidebar = document.getElementById('mm-sidebar')
    const offset  = document.getElementById('mm-sidebar-offset')
    const mainContent = document.getElementById('mm-main-content') || document.querySelector('.app')
    const icon = document.getElementById('mm-sidebar-toggle-icon')
    if (sidebar)  sidebar.style.width = isCollapsed ? '56px' : '200px'
    if (offset)   offset.style.marginLeft = isCollapsed ? '56px' : '200px'
    if (mainContent) mainContent.style.marginLeft = isCollapsed ? '56px' : '200px'
    if (icon) icon.textContent = isCollapsed ? '▶' : '◀'
    // Re-render links
    setTimeout(() => {
      const sidebar2 = document.getElementById('mm-sidebar')
      if (sidebar2) { const tmp=document.createElement('div'); tmp.innerHTML=buildHTML(isCollapsed); sidebar2.innerHTML=tmp.querySelector('nav').innerHTML }
      renderFavs(isCollapsed)
    }, 260)
  }

  return { init, toggle, renderFavs }
})()
