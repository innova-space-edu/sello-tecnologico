-- Corrige la visibilidad de historias de la comunidad.
-- Las historias permanecen visibles mientras su estado sea "published";
-- solo desaparecen cuando moderación las oculta o elimina.

begin;

alter table public.community_stories
  alter column expires_at drop default,
  alter column expires_at drop not null;

update public.community_stories
set expires_at = null
where visibility_status = 'published';

drop policy if exists community_stories_public_read on public.community_stories;
create policy community_stories_public_read
on public.community_stories for select
using (visibility_status = 'published');

drop policy if exists community_story_items_public_read on public.community_story_items;
create policy community_story_items_public_read
on public.community_story_items for select
using (
  exists (
    select 1
    from public.community_stories s
    where s.id = story_id
      and s.visibility_status = 'published'
  )
);

create or replace view public.community_active_stories
with (security_invoker = true)
as
select
  s.*,
  coalesce(r.reactions_count, 0)::integer as reactions_count,
  coalesce(c.comments_count, 0)::integer as comments_count,
  coalesce(v.views_count, 0)::integer as views_count
from public.community_stories s
left join (
  select story_id, count(*) reactions_count
  from public.community_story_reactions
  group by story_id
) r on r.story_id = s.id
left join (
  select story_id, count(*) comments_count
  from public.community_story_comments
  where is_hidden = false
  group by story_id
) c on c.story_id = s.id
left join (
  select story_id, count(*) views_count
  from public.community_story_views
  group by story_id
) v on v.story_id = s.id
where s.visibility_status = 'published';

grant select on public.community_active_stories to anon, authenticated;

commit;
notify pgrst, 'reload schema';
