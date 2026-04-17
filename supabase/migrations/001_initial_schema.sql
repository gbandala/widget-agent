-- ============================================
-- Widget Agent — Schema Inicial
-- Migración 001
-- ============================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- WIDGET TOKENS (un token por landing)
-- ============================================
CREATE TABLE widget_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  label TEXT NOT NULL,
  allowed_origin TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  bot_name TEXT DEFAULT 'Asistente',
  bot_avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tokens" ON widget_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- KNOWLEDGE BASE
-- ============================================
CREATE TABLE kb_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (
    category IN ('service', 'project_case', 'capability', 'faq', 'pricing')
  ),
  tags TEXT[],
  embedding VECTOR(1536),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kb_entries_embedding ON kb_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE kb_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active kb" ON kb_entries
  FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins manage kb" ON kb_entries
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- SESIONES DEL WIDGET
-- ============================================
CREATE TABLE widget_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES widget_tokens(id),
  anon_id TEXT NOT NULL,
  source_url TEXT,
  landing_content TEXT,           -- Cache del HTML parseado de la landing
  intent_detected TEXT CHECK (
    intent_detected IN ('browsing', 'interested', 'lead_captured', 'booked')
  ) DEFAULT 'browsing',
  interest_summary TEXT,
  lead_id UUID,
  appointment_id UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon insert sessions" ON widget_sessions
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Anon update own session" ON widget_sessions
  FOR UPDATE USING (TRUE);
CREATE POLICY "Admins see all sessions" ON widget_sessions
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "Anon see own session" ON widget_sessions
  FOR SELECT USING (TRUE);

-- ============================================
-- MENSAJES DEL CHAT
-- ============================================
CREATE TABLE widget_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  audio_input_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_widget_messages_session ON widget_messages(session_id, created_at ASC);

ALTER TABLE widget_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert messages" ON widget_messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Read messages" ON widget_messages FOR SELECT USING (TRUE);
CREATE POLICY "Admins manage messages" ON widget_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- LEADS / CONTACTOS
-- ============================================
CREATE TABLE widget_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT DEFAULT '1.0',
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert leads" ON widget_leads FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins manage leads" ON widget_leads
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- CITAS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES widget_sessions(id),
  lead_id UUID REFERENCES widget_leads(id),
  google_event_id TEXT NOT NULL,
  meet_link TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  status TEXT DEFAULT 'confirmed' CHECK (
    status IN ('confirmed', 'cancelled', 'rescheduled', 'completed')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert appointments" ON appointments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins manage appointments" ON appointments
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- LOG DE ERRORES
-- ============================================
CREATE TABLE widget_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  token_id UUID REFERENCES widget_tokens(id),
  error_type TEXT NOT NULL CHECK (
    error_type IN (
      'api_error',
      'quota_exceeded',
      'connection_error',
      'auth_error',
      'rate_limit',
      'injection_attempt',
      'scope_violation',
      'tool_error',
      'stt_error',
      'unknown'
    )
  ),
  message TEXT,
  source_url TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_token ON widget_error_logs(token_id, created_at DESC);
CREATE INDEX idx_error_logs_type ON widget_error_logs(error_type, created_at DESC);

ALTER TABLE widget_error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert error logs" ON widget_error_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins see error logs" ON widget_error_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- FUNCIÓN: Búsqueda semántica en KB
-- ============================================
CREATE OR REPLACE FUNCTION search_kb(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb_entries.id,
    kb_entries.title,
    kb_entries.content,
    kb_entries.category,
    kb_entries.tags,
    1 - (kb_entries.embedding <=> query_embedding) AS similarity
  FROM kb_entries
  WHERE
    is_active = TRUE
    AND 1 - (kb_entries.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_entries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
