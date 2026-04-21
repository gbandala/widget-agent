-- ============================================
-- Widget Agent — Migración 004
-- Configuración de personalidad del agente por token
-- ============================================

ALTER TABLE widget_tokens
  ADD COLUMN IF NOT EXISTS agent_language    TEXT NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS agent_tone        TEXT NOT NULL DEFAULT 'profesional',
  ADD COLUMN IF NOT EXISTS agent_instructions TEXT,
  ADD COLUMN IF NOT EXISTS agent_scope        TEXT,
  ADD COLUMN IF NOT EXISTS welcome_message    TEXT;

ALTER TABLE widget_tokens
  ADD COLUMN IF NOT EXISTS agent_use_emojis BOOLEAN NOT NULL DEFAULT true;
