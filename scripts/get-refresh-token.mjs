/**
 * Script para obtener el Google OAuth refresh token.
 * Uso: node scripts/get-refresh-token.mjs
 *
 * Abre el navegador, pide permiso a Google Calendar,
 * captura el callback en localhost:3001 y muestra el refresh token.
 */

import http from 'http'
import { exec } from 'child_process'
import { google } from 'googleapis'

// Cargar desde .env.local o variables de entorno
const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? ''
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  ?? 'http://localhost:3001/callback'

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
})

console.log('\n🔑 Abriendo navegador para autorizar Google Calendar...\n')

// Abrir navegador en Windows
exec(`start "" "${authUrl}"`)

// Servidor temporal en :3001 para capturar el callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3001')
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<h2>Error: ${error}</h2><p>Cierra esta ventana.</p>`)
    server.close()
    console.error('\n❌ El usuario canceló o hubo un error:', error)
    process.exit(1)
  }

  if (!code) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Esperando...')
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <html><body style="font-family:monospace;padding:2rem">
        <h2>✅ ¡Autorización exitosa!</h2>
        <p>Copia el refresh token de la terminal y cierra esta ventana.</p>
      </body></html>
    `)

    server.close()

    console.log('\n✅ TOKENS OBTENIDOS\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\nCopia esa línea y pégala en Dokploy → Environment Variables.')
    if (tokens.access_token) {
      console.log('\n(access_token también disponible pero no es necesario guardar)')
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Error al obtener tokens: ' + err.message)
    console.error('\n❌ Error al canjear el code:', err.message)
    server.close()
    process.exit(1)
  }
})

server.listen(3001, () => {
  console.log('Servidor de callback escuchando en http://localhost:3001')
  console.log('Si el navegador no abrió, ve manualmente a:\n')
  console.log(authUrl)
  console.log('\nEsperando autorización...')
})
