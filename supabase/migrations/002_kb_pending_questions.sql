-- Preguntas que el bot no pudo responder (sin info en KB ni landing)
-- El administrador revisa estas y puede crear entradas KB directamente desde el panel

CREATE TABLE IF NOT EXISTS kb_pending_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  session_id  UUID REFERENCES widget_sessions(id) ON DELETE SET NULL,
  token_id    UUID REFERENCES widget_tokens(id) ON DELETE SET NULL,
  source_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'ignored')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_kb_pending_status ON kb_pending_questions(status, created_at DESC);
