-- Migration 005: KB entries scoped per token (multi-tenant isolation)
--
-- token_id = NULL  → entrada global (visible a todos los tokens)
-- token_id = <uuid> → entrada privada (visible solo a ese token + búsquedas globales)
--
-- La función search_kb recibe p_token_id opcional:
--   - Si se provee: devuelve entradas del token + entradas globales (NULL)
--   - Si es NULL:   devuelve todas (para búsquedas admin)

ALTER TABLE kb_entries
  ADD COLUMN IF NOT EXISTS token_id UUID REFERENCES widget_tokens(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kb_entries_token ON kb_entries(token_id);

-- Actualizar RLS: lectura pública solo de entradas activas (sin cambio en lógica)
-- El filtro por token_id se hace en la función, no en RLS

-- Reemplazar función search_kb con versión que filtra por token
CREATE OR REPLACE FUNCTION search_kb(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 5,
  p_token_id UUID DEFAULT NULL
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
    -- Si p_token_id es NULL (llamada admin): devuelve todo
    -- Si p_token_id está seteado: solo entradas de ese token O globales
    AND (
      p_token_id IS NULL
      OR kb_entries.token_id = p_token_id
      OR kb_entries.token_id IS NULL
    )
    AND 1 - (kb_entries.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_entries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
