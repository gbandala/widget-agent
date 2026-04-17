import { google } from 'googleapis'

/**
 * Crea un cliente autenticado de Google Calendar
 * usando el refresh token de la cuenta del consultor.
 */
export function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? 'primary'
export const DEFAULT_MEETING_DURATION_MINUTES = 30
