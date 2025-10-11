-- Elimina definitivamente tutte le fonti deprecated Monty Security
DELETE FROM ingest_sources 
WHERE name LIKE '[DEPRECATED]%';