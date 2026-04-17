export interface WidgetConfig {
  token: string
  botName: string
  botAvatarUrl?: string
  sourceUrl: string
}

export interface WidgetMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  audioInputUrl?: string
  metadata?: {
    kbRefs?: string[]
    toolCalls?: string[]
    landingRef?: string
  }
  createdAt: string
}

export interface WidgetSession {
  id: string
  anonId: string
  tokenId: string
  sourceUrl: string
  intentDetected: 'browsing' | 'interested' | 'lead_captured' | 'booked'
  interestSummary?: string
  leadId?: string
  appointmentId?: string
}

export interface LeadData {
  name: string
  email: string
  company?: string
  phone?: string
  privacyAccepted: boolean
}

export interface AppointmentSlot {
  start: string
  end: string
  label: string
}

export interface WidgetError {
  error: true
  errorType: 'api_error' | 'quota_exceeded' | 'connection_error' | 'auth_error' | 'rate_limit' | 'injection_attempt' | 'scope_violation' | 'tool_error' | 'stt_error' | 'unknown'
  message: string
  retryable: boolean
}
