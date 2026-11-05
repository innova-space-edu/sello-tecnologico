-- Publicación institucional sin datos personales: alternativa estricta a
-- consentimientos personales, únicamente mediante declaración expresa
-- del administrador que subió la obra y revisión humana.
begin;

alter table public.creative_space_works
  add column publication_basis text not null default 'personal',
  add column institutional_attested_at timestamptz,
  add column institutional_attested_by uuid references auth.users(id) on delete set null;

alter table public.creative_space_works
  add constraint creative_space_publication_basis_check
    check (publication_basis in ('personal', 'institutional')),
  add constraint creative_space_institutional_attestation_check
    check (publication_basis <> 'institutional' or (
      rights_confirmed = true
      and institutional_attested_at is not null
      and institutional_attested_by is not null
    ));

-- Conserva RLS y el bloqueo del acceso directo a Data API.
commit;
