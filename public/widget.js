;(function () {
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script')
    return scripts[scripts.length - 1]
  })()

  var config = window.widgetConfig || {}
  var token = config.token || script.getAttribute('data-token')
  var botName = config.botName || script.getAttribute('data-bot-name') || 'Asistente'
  var welcomeMessage = config.welcomeMessage || script.getAttribute('data-welcome-message')
  var botAvatarUrl = config.botAvatarUrl || script.getAttribute('data-avatar-url')

  if (!token) {
    console.error('[Widget] data-token is required')
    return
  }

  // Resolve base URL from script src (strips /widget.js and anything after)
  var baseUrl = config.baseUrl
  if (!baseUrl) {
    var src = script.src || ''
    baseUrl = src.replace(/\/widget\.js(\?.*)?$/, '')
  }

  var params = new URLSearchParams({ token: token, botName: botName })
  if (welcomeMessage) params.set('welcomeMessage', welcomeMessage)
  if (botAvatarUrl) params.set('botAvatarUrl', botAvatarUrl)
  params.set('sourceUrl', window.location.href)

  // FAB button
  var fab = document.createElement('button')
  fab.setAttribute('aria-label', 'Abrir chat de consultoría')
  fab.style.cssText = [
    'position:fixed', 'bottom:24px', 'right:24px', 'z-index:2147483646',
    'width:56px', 'height:56px', 'background:#2563eb', 'border:none',
    'border-radius:50%', 'cursor:pointer',
    'box-shadow:0 4px 16px rgba(37,99,235,0.4)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'transition:transform 0.15s,background 0.15s',
  ].join(';')

  var chatIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>'
  var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>'

  fab.innerHTML = chatIcon

  // Iframe
  var iframe = document.createElement('iframe')
  iframe.src = baseUrl + '/embed?' + params.toString()
  iframe.setAttribute('allow', 'microphone')
  iframe.setAttribute('title', 'Chat de consultoría')
  iframe.style.cssText = [
    'position:fixed', 'bottom:88px', 'right:24px', 'z-index:2147483647',
    'width:400px', 'height:600px', 'max-width:calc(100vw - 32px)',
    'max-height:calc(100vh - 112px)',
    'border:none', 'border-radius:16px',
    'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
    'display:none',
    'transition:opacity 0.2s,transform 0.2s',
    'opacity:0', 'transform:translateY(8px) scale(0.97)',
  ].join(';')

  var isOpen = false

  function open() {
    isOpen = true
    iframe.style.display = 'block'
    requestAnimationFrame(function () {
      iframe.style.opacity = '1'
      iframe.style.transform = 'translateY(0) scale(1)'
    })
    fab.innerHTML = closeIcon
    fab.setAttribute('aria-label', 'Cerrar chat')
    fab.style.background = '#1d4ed8'
  }

  function close() {
    isOpen = false
    iframe.style.opacity = '0'
    iframe.style.transform = 'translateY(8px) scale(0.97)'
    setTimeout(function () {
      if (!isOpen) iframe.style.display = 'none'
    }, 200)
    fab.innerHTML = chatIcon
    fab.setAttribute('aria-label', 'Abrir chat de consultoría')
    fab.style.background = '#2563eb'
  }

  fab.addEventListener('click', function () {
    isOpen ? close() : open()
  })

  fab.addEventListener('mouseenter', function () {
    fab.style.transform = 'scale(1.05)'
  })
  fab.addEventListener('mouseleave', function () {
    fab.style.transform = 'scale(1)'
  })

  // Listen for close message from iframe
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'widget-close') close()
  })

  document.body.appendChild(fab)
  document.body.appendChild(iframe)
})()
