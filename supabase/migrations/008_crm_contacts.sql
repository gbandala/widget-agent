-- ============================================
-- Migración 008 — CRM contacts
-- Capa de pipeline sobre widget_leads
-- ============================================

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo con widget (nullable para contactos directos)
  widget_lead_id UUID REFERENCES widget_leads(id) ON DELETE SET NULL,

  -- Identificación (email y telefono cifrados con PII_ENCRYPTION_KEY)
  nombre      TEXT NOT NULL,
  empresa     TEXT,
  email_enc   TEXT,   -- AES-256-CBC igual que widget_leads
  telefono_enc TEXT,  -- AES-256-CBC

  -- Origen
  origen TEXT NOT NULL DEFAULT 'directo'
    CHECK (origen IN ('widget', 'directo', 'referido')),
  referido_por TEXT,
  como_conocio TEXT,  -- "LinkedIn", "evento Amplify", "referido de X"

  -- Pipeline (SOP comercial T0–T5)
  etapa TEXT NOT NULL DEFAULT 'T0'
    CHECK (etapa IN ('T0','T1','T2','T3','T4','T5','perdido','inactivo')),
  etapa_updated_at TIMESTAMPTZ DEFAULT NOW(),
  motivo_perdido TEXT,

  -- Calificación
  bant_score        INT CHECK (bant_score BETWEEN 0 AND 20),
  icp_fit           TEXT CHECK (icp_fit IN ('si','parcial','no')),
  cero_estrategico  TEXT CHECK (cero_estrategico IN ('financiero','temporal','cognitivo','relacional')),
  banderas_rojas    TEXT,

  -- Preferencia de contacto
  preferred_contact TEXT CHECK (preferred_contact IN ('whatsapp','email','llamada')),

  -- Próxima acción
  proxima_accion       TEXT,
  proxima_accion_fecha DATE,

  -- Seguimiento de sesiones
  sesiones_count       INT DEFAULT 0,
  ultima_sesion_fecha  DATE,
  ultima_sesion_path   TEXT,  -- ruta a sesion-NN.md en clarifica-os

  -- Notas internas
  notas TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- etapa_updated_at solo cuando cambia la etapa
CREATE OR REPLACE FUNCTION update_etapa_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.etapa_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_etapa_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_etapa_timestamp();

-- Un widget_lead solo puede originar un contacto CRM
ALTER TABLE contacts ADD CONSTRAINT uq_contacts_widget_lead UNIQUE (widget_lead_id);

-- Índices
CREATE INDEX idx_contacts_etapa             ON contacts(etapa);
CREATE INDEX idx_contacts_origen            ON contacts(origen);
CREATE INDEX idx_contacts_widget_lead       ON contacts(widget_lead_id);
CREATE INDEX idx_contacts_proxima_accion    ON contacts(proxima_accion_fecha)
  WHERE proxima_accion_fecha IS NOT NULL;

-- ============================================
-- Roles de acceso para agentes (ejecutar manualmente
-- con las credenciales correctas del superusuario)
-- ============================================
-- Rol de solo lectura — reporting, monitor, dashboard
-- CREATE ROLE clarifica_ro LOGIN PASSWORD '${RO_DB_PASSWORD}';
-- GRANT CONNECT ON DATABASE widget_agent TO clarifica_ro;
-- GRANT USAGE ON SCHEMA public TO clarifica_ro;
-- GRANT SELECT ON contacts, widget_leads, appointments TO clarifica_ro;

-- Rol CRM — lectura y escritura en contacts, lectura en widget_leads/appointments
-- CREATE ROLE clarifica_crm LOGIN PASSWORD '${CRM_DB_PASSWORD}';
-- GRANT CONNECT ON DATABASE widget_agent TO clarifica_crm;
-- GRANT USAGE ON SCHEMA public TO clarifica_crm;
-- GRANT SELECT, INSERT, UPDATE ON contacts TO clarifica_crm;
-- GRANT SELECT ON widget_leads, appointments TO clarifica_crm;
