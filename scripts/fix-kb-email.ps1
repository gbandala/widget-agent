# Obtener el container ID del postgres del widget
$cid = ssh gabriel@5.78.221.16 "docker ps --filter name=widgetpostgres -q"
Write-Host "Container: $cid"

# Ejecutar el UPDATE directamente
ssh gabriel@5.78.221.16 "docker exec $cid psql -U widget_user -d widget_agent -c `"UPDATE kb_entries SET content = REPLACE(content, 'gabriel.bandala@gmail.com', 'contacto@clariifica.com') WHERE content LIKE '%gabriel.bandala@gmail.com%'`""

# Verificar
ssh gabriel@5.78.221.16 "docker exec $cid psql -U widget_user -d widget_agent -c `"SELECT COUNT(*) as actualizadas FROM kb_entries WHERE content LIKE '%gabriel.bandala%'`""
