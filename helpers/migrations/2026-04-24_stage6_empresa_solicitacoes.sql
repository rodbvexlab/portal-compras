-- 2026-04-24_stage6_empresa_solicitacoes.sql
-- Objetivo: adicionar empresa em solicitacoes com compatibilidade legada

begin;

alter table public.solicitacoes
  add column if not exists empresa varchar(32);

alter table public.solicitacoes
  alter column empresa set default 'grupo_acontrans';

update public.solicitacoes
set empresa = 'grupo_acontrans'
where empresa is null
   or btrim(empresa) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_solicitacoes_empresa'
      and conrelid = 'public.solicitacoes'::regclass
  ) then
    alter table public.solicitacoes
      add constraint chk_solicitacoes_empresa
      check (empresa in ('grupo_acontrans', 'acontrans', 'acontrans_sp', 'acseg'));
  end if;
end $$;

alter table public.solicitacoes
  alter column empresa set not null;

create index if not exists idx_solicitacoes_empresa
  on public.solicitacoes (empresa);

commit;
