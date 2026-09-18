-- "Download or delete my data" (Legal hub). Users can delete their own account.
-- Runs as definer so it can remove the auth.users row; cascades clean up everything.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  -- Hand trips owned by this user with other members to the earliest editor, otherwise delete.
  update public.trips t set owner_id = m.user_id
  from (
    select distinct on (trip_id) trip_id, user_id
    from public.trip_members
    where user_id <> auth.uid() and role in ('owner','editor')
    order by trip_id, created_at
  ) m
  where t.owner_id = auth.uid() and t.id = m.trip_id;
  update public.trip_members set role = 'owner'
  where (trip_id, user_id) in (select id, owner_id from public.trips where owner_id <> auth.uid() and id in (select trip_id from public.trip_members where user_id = auth.uid()));

  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- Data export: everything the user can see, as JSON (GDPR/CCPA access request).
create or replace function public.export_my_data() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'trips', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.trips t),
    'places', (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from public.places pl),
    'stays', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.stays s),
    'itinerary', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.itinerary_items i),
    'exported_at', now()
  );
$$;
revoke all on function public.export_my_data() from public;
grant execute on function public.export_my_data() to authenticated;
