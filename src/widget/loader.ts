export {}

declare global {
  interface Window {
    widgetConfig?: {
      token?: string
      botName?: string
      welcomeMessage?: string
      botAvatarUrl?: string
      color?: string
      position?: string
      baseUrl?: string
    }
  }
}

const script =
  (document.currentScript as HTMLScriptElement) ||
  (() => {
    const scripts = document.getElementsByTagName('script')
    return scripts[scripts.length - 1]
  })()

const attr = (name: string) => script.getAttribute(`data-${name}`) ?? undefined
const env = window.widgetConfig ?? {}

const token = env.token ?? attr('token')
if (!token) {
  console.error('[Widget] data-token is required')
  throw new Error('widget: missing token')
}

const botName = env.botName ?? attr('bot-name') ?? 'Asistente'
const welcomeMessage = env.welcomeMessage ?? attr('welcome-message')
const botAvatarUrl = env.botAvatarUrl ?? attr('avatar-url')
const primaryColor = env.color ?? attr('color') ?? '#2563eb'
const position = env.position ?? attr('position') ?? 'bottom-right'
const isLeft = position === 'bottom-left'

let baseUrl = env.baseUrl ?? attr('base-url') ?? ''
if (!baseUrl) {
  baseUrl = (script.src ?? '').replace(/\/widget\.js(\?.*)?$/, '')
}

// Build embed URL
const params = new URLSearchParams({ token, botName })
if (welcomeMessage) params.set('welcomeMessage', welcomeMessage)
if (botAvatarUrl) params.set('botAvatarUrl', botAvatarUrl)
params.set('sourceUrl', window.location.href)
const embedUrl = `${baseUrl}/embed?${params}`

// Darken a #rrggbb hex color for hover/active states
function darken(hex: string): string {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, (n >> 16) - 30)
  const g = Math.max(0, ((n >> 8) & 0xff) - 30)
  const b = Math.max(0, (n & 0xff) - 30)
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

const activeColor = darken(primaryColor)

const ICON_CHAT = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`
const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>`

// FAB
const fab = document.createElement('button')
fab.setAttribute('type', 'button')
fab.setAttribute('aria-label', 'Abrir chat')
fab.setAttribute('aria-expanded', 'false')
fab.style.cssText = [
  'position:fixed',
  'bottom:24px',
  isLeft ? 'left:24px' : 'right:24px',
  'z-index:2147483646',
  'width:56px', 'height:56px',
  `background:${primaryColor}`,
  'border:none', 'border-radius:50%', 'cursor:pointer',
  'box-shadow:0 4px 16px rgba(0,0,0,0.25)',
  'display:flex', 'align-items:center', 'justify-content:center',
  'transition:transform 0.15s,background 0.15s',
  'padding:0',
].join(';')
fab.innerHTML = ICON_CHAT

// Iframe (created lazily on first open / preload on idle)
let iframe: HTMLIFrameElement | null = null
let iframeLoaded = false
let isOpen = false
let pendingOpen = false

const MQ_MOBILE = window.matchMedia('(max-width:639px)')

function applyLayout(mobile: boolean) {
  if (!iframe) return
  if (mobile) {
    Object.assign(iframe.style, {
      bottom: '0', top: '0',
      left: '0', right: '0',
      width: '100%', height: '100%',
      maxWidth: '100%', maxHeight: '100%',
      borderRadius: '0',
    })
  } else {
    Object.assign(iframe.style, {
      bottom: '88px', top: '',
      left: isLeft ? '24px' : '',
      right: isLeft ? '' : '24px',
      width: '400px', height: '600px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 112px)',
      borderRadius: '16px',
    })
  }
}

function createIframe() {
  if (iframe) return
  iframe = document.createElement('iframe')
  iframe.src = embedUrl
  iframe.setAttribute('allow', 'microphone')
  iframe.setAttribute('title', 'Chat de asistente')
  iframe.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'border:none',
    'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
    'display:none',
    'transition:opacity 0.2s,transform 0.2s',
    'opacity:0', 'transform:translateY(8px) scale(0.97)',
  ].join(';')
  applyLayout(MQ_MOBILE.matches)
  MQ_MOBILE.addEventListener('change', e => applyLayout(e.matches))

  iframe.addEventListener('load', () => {
    iframeLoaded = true
    if (pendingOpen) {
      pendingOpen = false
      showIframe()
    }
  })

  document.body.appendChild(iframe)
}

function showIframe() {
  if (!iframe) return
  iframe.style.display = 'block'
  requestAnimationFrame(() => {
    if (!iframe) return
    iframe.style.opacity = '1'
    iframe.style.transform = 'translateY(0) scale(1)'
  })
}

function hideIframe() {
  if (!iframe) return
  iframe.style.opacity = '0'
  iframe.style.transform = 'translateY(8px) scale(0.97)'
  setTimeout(() => {
    if (!isOpen && iframe) iframe.style.display = 'none'
  }, 210)
}

function open() {
  isOpen = true
  if (!iframe) {
    createIframe()
    pendingOpen = true
  } else if (iframeLoaded) {
    showIframe()
  } else {
    pendingOpen = true
  }
  fab.innerHTML = ICON_CLOSE
  fab.setAttribute('aria-label', 'Cerrar chat')
  fab.setAttribute('aria-expanded', 'true')
  fab.style.background = activeColor
}

function close() {
  isOpen = false
  pendingOpen = false
  hideIframe()
  fab.innerHTML = ICON_CHAT
  fab.setAttribute('aria-label', 'Abrir chat')
  fab.setAttribute('aria-expanded', 'false')
  fab.style.background = primaryColor
}

// Preload iframe after page is idle — improves TTFI on first click
function schedulePreload() {
  if ('requestIdleCallback' in window) {
    ;(window as typeof window & { requestIdleCallback: (cb: () => void, o?: object) => void }).requestIdleCallback(
      createIframe,
      { timeout: 5000 },
    )
  } else {
    setTimeout(createIframe, 3000)
  }
}

if (document.readyState === 'complete') {
  schedulePreload()
} else {
  window.addEventListener('load', schedulePreload, { once: true })
}

// FAB interactions
fab.addEventListener('click', () => (isOpen ? close() : open()))

fab.addEventListener('mouseenter', () => {
  fab.style.transform = 'scale(1.05)'
  fab.style.background = activeColor
})
fab.addEventListener('mouseleave', () => {
  fab.style.transform = 'scale(1)'
  fab.style.background = isOpen ? activeColor : primaryColor
})
fab.addEventListener('focus', () => {
  fab.style.outline = `3px solid ${primaryColor}`
  fab.style.outlineOffset = '3px'
})
fab.addEventListener('blur', () => {
  fab.style.outline = 'none'
})

// ESC closes widget
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isOpen) close()
})

// postMessage bridge: iframe close button + programmatic control from host
window.addEventListener('message', e => {
  if (!e.data || typeof e.data !== 'object') return
  if (e.data.type === 'widget-close') close()
  if (e.data.type === 'widget-open') open()
})

document.body.appendChild(fab)
