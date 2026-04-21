/**
 * Script one-time: genera el refresh token de Google Calendar
 * Uso: node scripts/get-google-token.mjs
 */
import { createServer } from 'http'
import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar .env.local
const envPath = join(process.cwd(), '.env.local')
const env = readFileSync(envPath, 'utf-8')
for (const line of env.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key?.trim() && rest.length > 0) {
    process.env[key.trim()] = rest.join('=').trim()
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3001/callback'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env.local')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
})

console.log('\n════════════════════════════════════════')
console.log('  Google Calendar — Obtener Refresh Token')
console.log('════════════════════════════════════════')
console.log('\n1. Abre esta URL en tu browser:\n')
console.log('   ' + authUrl)
console.log('\n2. Inicia sesión con tu cuenta de Google')
console.log('3. Autoriza el acceso al calendario')
console.log('\nEsperando callback en http://localhost:3001/callback ...\n')

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:3001')
  const code = url.searchParams.get('code')

  if (!code) {
    res.end('No se recibió código de autorización.')
    return
  }

  try {
    const { tokens } = await oauth2Client.getToken(code)
    res.end('<h2>✓ ¡Listo! Puedes cerrar esta pestaña.</h2>')

    console.log('════════════════════════════════════════')
    console.log('  REFRESH TOKEN OBTENIDO:')
    console.log('════════════════════════════════════════')
    console.log('\n  ' + tokens.refresh_token)
    console.log('\n  Agrega esto en Vercel:')
    console.log('  GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token)
    console.log('\n════════════════════════════════════════\n')
  } catch (e) {
    res.end('Error: ' + e.message)
    console.error(e)
  }

  server.close()
}).listen(3001)
