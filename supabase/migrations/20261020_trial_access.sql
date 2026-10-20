-- Run once in Supabase SQL Editor. Quotas and approvals are server-only.
create table if not exists public.app_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  status text not null default 'trial' check (status in ('trial','pending','approved','rejected')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.tailoring_jobs (
  id uuid primary key,
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  state text not null check (state in ('running','completed','failed')),
  result jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tailoring_jobs_owner on public.tailoring_jobs(user_id, state);
alter table public.app_accounts enable row level security;
alter table public.tailoring_jobs enable row level security;
revoke all on public.app_accounts, public.tailoring_jobs from anon, authenticated;
grant all on public.app_accounts, public.tailoring_jobs to service_role;

create or replace function public.reserve_tailoring(p_user uuid, p_job uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.app_accounts; j public.tailoring_jobs; used integer;
begin
  select * into a from public.app_accounts where user_id = p_user for update;
  if not found then raise exception 'Account not found'; end if;
  select * into j from public.tailoring_jobs where id = p_job;
  if found then
    if j.user_id <> p_user then return jsonb_build_object('error','Invalid request ID'); end if;
    if j.state = 'completed' then return jsonb_build_object('result',j.result); end if;
    if j.state = 'running' and j.created_at > now() - interval '20 minutes' then
      return jsonb_build_object('error','This resume is still being generated','busy',true);
    end if;
    delete from public.tailoring_jobs where id = p_job;
  end if;
  if a.status in ('pending','rejected') and not a.is_admin then
    return jsonb_build_object('error','Admin approval is required');
  end if;
  select count(*) into used from public.tailoring_jobs where user_id = p_user and
    (state = 'completed' or (state = 'running' and created_at > now() - interval '20 minutes'));
  if a.status <> 'approved' and not a.is_admin and used >= 4 then
    return jsonb_build_object('error','Your four free resumes have been used. Register and request admin approval.');
  end if;
  insert into public.tailoring_jobs(id,user_id,state) values(p_job,p_user,'running');
  return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_tailoring(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_tailoring(uuid,uuid) to service_role;
