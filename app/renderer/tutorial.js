// tutorial.js — ModMaster first-launch tutorial
// Call MM_Tutorial.start() on first launch. User can skip at any step.

window.MM_Tutorial = (function () {

  const STEPS = [
    {
      title: 'Welcome to ModMaster',
      text:  'The easiest way to create, fix and manage mods for any game. No coding needed.',
      target: null,
      position: 'center',
    },
    {
      title: 'Pick a feature',
      text:  'Tap any card to get started. Create new mods, fix broken ones, rework existing ones, or install modding tools.',
      target: '.cards-grid',
      position: 'bottom',
    },
    {
      title: 'Your games',
      text:  "ModMaster has scanned your PC and found your installed games. Star a game to pin it as a favourite for quick access.",
      target: '#game-section',
      position: 'bottom',
    },
    {
      title: 'Settings',
      text:  'Add your API key, change themes, set up auto-updates, and customise your background here.',
      target: '#settings-btn',
      position: 'top',
    },
    {
      title: "You're all set!",
      text:  'That\'s everything. Jump in and start modding. You can revisit this guide anytime from Settings.',
      target: null,
      position: 'center',
    },
  ]

  let currentStep = 0
  let overlay, card

  function getTargetRect(selector) {
    if (!selector) return null
    const el = document.querySelector(selector)
    return el ? el.getBoundingClientRect() : null
  }

  function render() {
    const step = STEPS[currentStep]
    const isFirst = currentStep === 0
    const isLast  = currentStep === STEPS.length - 1

    // Spotlight position
    const rect = getTargetRect(step.target)
    if (rect && overlay) {
      const pad = 12
      overlay.style.background = 'none'
      overlay.style.boxShadow  = `0 0 0 9999px rgba(0,0,0,0.75), 0 0 0 2px var(--teal,#2dd4a0) inset`
      overlay.style.left   = (rect.left - pad) + 'px'
      overlay.style.top    = (rect.top  - pad) + 'px'
      overlay.style.width  = (rect.width  + pad*2) + 'px'
      overlay.style.height = (rect.height + pad*2) + 'px'
      overlay.style.borderRadius = '12px'
    } else if (overlay) {
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9998;border-radius:0;box-shadow:none;'
    }

    // Card content
    if (card) {
      card.innerHTML = `
        <div style="font-family:Rajdhani,sans-serif;font-size:1.3rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--teal,#2dd4a0);margin-bottom:10px;">${step.title}</div>
        <div style="font-size:14px;color:var(--text,#e8eaf0);line-height:1.65;margin-bottom:1.5rem;">${step.text}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <button onclick="MM_Tutorial.skip()" style="background:none;border:0.5px solid var(--border,rgba(255,255,255,0.1));border-radius:8px;padding:8px 16px;color:var(--muted,#6b7080);font-family:Rajdhani,sans-serif;font-size:0.85rem;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;">Skip tour</button>
          <div style="display:flex;gap:6px;align-items:center;">
            ${STEPS.map((_,i) => `<div style="width:${i===currentStep?'20':'6'}px;height:6px;border-radius:99px;background:${i===currentStep?'var(--teal,#2dd4a0)':'var(--border,rgba(255,255,255,0.1))'};transition:all 0.2s;"></div>`).join('')}
          </div>
          <button onclick="MM_Tutorial.next()" style="background:var(--teal,#2dd4a0);border:none;border-radius:8px;padding:8px 20px;color:#0a1a14;font-family:Rajdhani,sans-serif;font-size:0.9rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;cursor:pointer;">${isLast?'Get started':'Next →'}</button>
        </div>
      `

      // Position card
      if (rect && step.position !== 'center') {
        const cardH = 180
        const top = step.position === 'top'
          ? rect.top - cardH - 20
          : rect.bottom + 20
        card.style.top  = Math.max(20, Math.min(window.innerHeight - cardH - 20, top)) + 'px'
        card.style.left = Math.max(20, Math.min(window.innerWidth - 360 - 20, rect.left)) + 'px'
        card.style.transform = 'none'
      } else {
        card.style.top       = '50%'
        card.style.left      = '50%'
        card.style.transform = 'translate(-50%,-50%)'
      }
    }
  }

  function start() {
    currentStep = 0

    // Overlay
    overlay = document.createElement('div')
    overlay.id = 'mm-tutorial-overlay'
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9998;transition:all 0.3s;'
    document.body.appendChild(overlay)

    // Card
    card = document.createElement('div')
    card.id = 'mm-tutorial-card'
    card.style.cssText = `
      position:fixed;z-index:9999;
      background:var(--bg2,#13161b);
      border:0.5px solid var(--teal,#2dd4a0);
      border-radius:16px;padding:1.5rem;
      width:340px;max-width:calc(100vw - 40px);
      box-shadow:0 20px 60px rgba(0,0,0,0.6);
      animation:tutorialIn 0.3s ease forwards;
    `
    document.body.appendChild(card)

    // Inject animation
    if (!document.getElementById('mm-tutorial-style')) {
      const style = document.createElement('style')
      style.id = 'mm-tutorial-style'
      style.textContent = '@keyframes tutorialIn{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}'
      document.head.appendChild(style)
    }

    render()
  }

  function next() {
    currentStep++
    if (currentStep >= STEPS.length) { skip(); return }
    render()
  }

  function skip() {
    overlay?.remove()
    card?.remove()
    overlay = null
    card    = null
    localStorage.setItem('mm-tutorial-done', '1')
  }

  return { start, next, skip }
})()
