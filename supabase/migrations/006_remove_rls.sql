-- Eliminar RLS — control de acceso ahora en Next.js API layer
ALTER TABLE widget_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE kb_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE widget_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE widget_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE widget_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE widget_error_logs DISABLE ROW LEVEL SECURITY;

-- Eliminar policies que dependen de auth.jwt()
DROP POLICY IF EXISTS "Admins manage tokens" ON widget_tokens;
DROP POLICY IF EXISTS "Public read active kb" ON kb_entries;
DROP POLICY IF EXISTS "Admins manage kb" ON kb_entries;
DROP POLICY IF EXISTS "Admins see all sessions" ON widget_sessions;
DROP POLICY IF EXISTS "Admins manage messages" ON widget_messages;
DROP POLICY IF EXISTS "Admins manage leads" ON widget_leads;
DROP POLICY IF EXISTS "Admins manage appointments" ON appointments;
DROP POLICY IF EXISTS "Admins see error logs" ON widget_error_logs;
