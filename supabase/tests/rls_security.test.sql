begin;
select plan(8);

-- Seed identities as the database owner. The signup trigger creates profiles/roles.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@test.local', 'test-only', now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'collector@test.local', 'test-only', now()),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'analyst@test.local', 'test-only', now());

update public.profiles set status = 'active'
where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');
delete from public.user_roles where user_id = '10000000-0000-0000-0000-000000000003';
insert into public.user_roles(user_id, role)
values ('10000000-0000-0000-0000-000000000003', 'analyst');

insert into public.incidents (
  reporter_id, incident_date, region, location_name, category, description, status
) values (
  '10000000-0000-0000-0000-000000000002', current_date, 'Test', 'Test site', 'Spill', 'RLS fixture', 'submitted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$update public.profiles set status = 'active' where id = '10000000-0000-0000-0000-000000000002'$$,
  'P0001', 'Only an administrator may change account status or email',
  'pending users cannot activate themselves'
);
select is((select count(*)::integer from public.incidents), 0, 'pending users cannot read incidents');
select throws_ok(
  $$select public.begin_incident_submission(gen_random_uuid(), '{}'::jsonb, 0)$$,
  'P0001', 'Active authentication required',
  'pending users cannot begin submissions'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.profiles set status = 'active' where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.incidents), 1, 'active collector reads own incident');
select throws_ok(
  $$select public.transition_incident_status((select id from public.incidents limit 1), 'under_review', null)$$,
  'P0001', 'Insufficient role',
  'collector cannot invoke lifecycle transition'
);

reset role;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
update public.profiles set status = 'suspended' where id = '10000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.incidents), 0, 'suspension immediately removes incident access');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$select public.transition_incident_status((select id from public.incidents limit 1), 'under_review', 'test')$$,
  'analyst can perform an allowed transition'
);
select is((select status::text from public.incidents limit 1), 'under_review', 'allowed transition persists');

select * from finish();
rollback;
