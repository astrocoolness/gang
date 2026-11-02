-- CI ONLY: disposable database fixtures. Never run on a user's Supabase database.
create schema if not exists auth;
create table auth.users (id uuid primary key);
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to service_role;
insert into auth.users(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333333');
