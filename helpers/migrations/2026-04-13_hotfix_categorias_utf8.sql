BEGIN;

-- Hotfix: normaliza categorias com mojibake para UTF-8.
-- Idempotente: roda sem efeito quando os textos ja estiverem corretos.

UPDATE categorias
SET nome = 'Escritório'
WHERE nome IN ('EscritÃ³rio', 'Escrit¢rio');

UPDATE categorias
SET nome = 'Serviços'
WHERE nome IN ('ServiÃ§os', 'Servi‡os');

UPDATE categorias
SET nome = 'Manutenção'
WHERE nome IN ('ManutenÃ§Ã£o', 'Manuten‡Æo');

UPDATE categorias
SET nome = 'Material de Escritório'
WHERE nome IN ('Material de EscritÃ³rio', 'Material de Escrit¢rio');

UPDATE categorias
SET descricao = 'Equipamentos, periféricos, rede e servidores'
WHERE descricao IN (
  'Equipamentos, perifÃ©ricos, rede e servidores',
  'Equipamentos, perif‚ricos, rede e servidores'
);

UPDATE categorias
SET descricao = 'Licenças, sistemas e assinaturas'
WHERE descricao IN (
  'LicenÃ§as, sistemas e assinaturas',
  'Licen‡as, sistemas e assinaturas'
);

UPDATE categorias
SET descricao = 'Serviços terceirizados'
WHERE descricao IN ('ServiÃ§os terceirizados', 'Servi‡os terceirizados');

UPDATE categorias
SET descricao = 'Reparos e manutenção'
WHERE descricao IN ('Reparos e manutenÃ§Ã£o', 'Reparos e manuten‡Æo');

UPDATE categorias
SET descricao = 'Itens relacionados a veículos e operação'
WHERE descricao IN (
  'Itens relacionados a veÃ­culos e operaÃ§Ã£o',
  'Itens relacionados a ve¡culos e opera‡Æo'
);

COMMIT;

