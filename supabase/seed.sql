insert into public.sessions (
  id,
  status
)
values (
  '00000000-0000-4000-8000-000000000001',
  'created'
)
on conflict (id) do update
set status = excluded.status;
