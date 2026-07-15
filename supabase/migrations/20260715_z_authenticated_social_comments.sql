-- Los comentarios de páginas y publicaciones requieren una cuenta iniciada.
-- El nombre se obtiene automáticamente desde profiles.

begin;

drop policy if exists "public can insert comments on published pages"
  on public.project_public_page_comments;

drop policy if exists authenticated_comments_on_published_pages
  on public.project_public_page_comments;

create policy authenticated_comments_on_published_pages
on public.project_public_page_comments
for insert
to authenticated
with check (
  profile_id = auth.uid()
  and visitor_name is null
  and is_hidden = false
  and exists (
    select 1
    from public.project_public_pages p
    where p.id = page_id
      and p.is_public = true
      and p.status = 'published'
  )
);

revoke insert on public.project_public_page_comments from anon;
grant insert on public.project_public_page_comments to authenticated;

commit;
notify pgrst, 'reload schema';
