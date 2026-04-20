-- ============================================
-- Migración 003 — Categorías dinámicas
-- Elimina el CHECK constraint de kb_entries.category
-- para permitir categorías libres más allá de las 5 predefinidas.
-- ============================================
ALTER TABLE kb_entries
  DROP CONSTRAINT IF EXISTS kb_entries_category_check;
