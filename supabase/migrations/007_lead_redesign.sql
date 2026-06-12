-- ============================================
-- Migración 007 — Lead redesign conversacional
-- name nullable, contact_preference, lead_score
-- ============================================

-- name ya no es obligatorio (se captura solo el email inicialmente)
ALTER TABLE widget_leads ALTER COLUMN name DROP NOT NULL;
ALTER TABLE widget_leads ALTER COLUMN name SET DEFAULT NULL;

-- preferencia de contacto: whatsapp | call | email
ALTER TABLE widget_leads ADD COLUMN IF NOT EXISTS
  contact_preference TEXT CHECK (contact_preference IN ('whatsapp', 'call', 'email'));

-- score de calificación acumulado durante la conversación
ALTER TABLE widget_leads ADD COLUMN IF NOT EXISTS
  lead_score INT DEFAULT 0;

-- privacy_accepted ahora se da por confirmada al enviar el email (no requiere checkbox)
ALTER TABLE widget_leads ALTER COLUMN privacy_accepted SET DEFAULT TRUE;
