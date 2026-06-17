-- ============================================
-- Migración 009 — Roles de acceso idempotentes
-- Ejecutar como superusuario (widget_user)
-- ============================================
-- Crea los roles clarifica_ro y clarifica_crm si no existen,
-- y garantiza que todos los grants estén aplicados.
-- Idempotente: seguro de ejecutar varias veces.
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clarifica_ro') THEN
    CREATE ROLE clarifica_ro LOGIN PASSWORD '436b09760fbbd6e769df229cbd7aa707';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'clarifica_crm') THEN
    CREATE ROLE clarifica_crm LOGIN PASSWORD 'clarifica_crm_2026';
  END IF;
END$$;

-- ----------------------------------------
-- clarifica_ro — solo lectura
-- Usado por: MCP clarifica-db, telemetry-analyst, dashboard /infra
-- ----------------------------------------

GRANT CONNECT ON DATABASE widget_agent TO clarifica_ro;

-- Esquema public
GRANT USAGE ON SCHEMA public TO clarifica_ro;
GRANT SELECT ON
  contacts,
  widget_leads,
  widget_sessions,
  widget_messages,
  appointments,
  kb_entries,
  kb_pending_questions,
  widget_tokens,
  widget_error_logs
TO clarifica_ro;

-- Esquema telemetry (requerido por telemetry-analyst)
GRANT USAGE ON SCHEMA telemetry TO clarifica_ro;
GRANT SELECT ON
  telemetry.t_service_events,
  telemetry.t_visit_sessions,
  telemetry.t_access_events
TO clarifica_ro;

-- ----------------------------------------
-- clarifica_crm — escritura en contacts
-- Usado por: MCP clarifica-crm, agente CRM
-- ----------------------------------------

GRANT CONNECT ON DATABASE widget_agent TO clarifica_crm;

-- Esquema public
GRANT USAGE ON SCHEMA public TO clarifica_crm;
GRANT SELECT, INSERT, UPDATE ON contacts TO clarifica_crm;
GRANT SELECT ON widget_leads, appointments TO clarifica_crm;
