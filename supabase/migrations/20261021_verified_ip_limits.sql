begin;
-- Apply AFTER 20261020_trial_access.sql. Existing account totals are preserved.
alter table public.tailoring_jobs add column if not exists ip_key text;
alter table public.tailoring_jobs add column if not exists quota_day date;
create index if not exists tailoring_jobs_ip_day on public.tailoring_jobs(ip_key, quota_day, state);
create table if not exists public.trial_ip_buckets (
  ip_key text not null,
  quota_day date not null,
  primary key (ip_key, quota_day)
);
alter table public.trial_ip_buckets enable row level security;
revoke all on public.trial_ip_buckets from public, anon, authenticated;
grant all on public.trial_ip_buckets to service_role;

-- Remove the old signature so a stale deployment cannot bypass the daily limit.
drop function if exists public.reserve_tailoring(uuid, uuid);
create or replace function public.reserve_tailoring(p_user uuid, p_job uuid, p_ip_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.app_accounts;
  j public.tailoring_jobs;
  used integer;
  daily_used integer;
  day_utc date := (now() at time zone 'UTC')::date;
  full_access boolean;
begin
  if not exists (select 1 from auth.users where id = p_user
      and email_confirmed_at is not null and not coalesce(is_anonymous, false)) then
    return jsonb_build_object('error','Verify your email before starting your free trial','code','EMAIL_REQUIRED');
  end if;
  select * into a from public.app_accounts where user_id = p_user for update;
  if not found then raise exception 'Account not found'; end if;
  full_access := a.is_admin or a.status = 'approved';
  if a.status in ('pending','rejected') and not a.is_admin then
    return jsonb_build_object('error','Admin approval is required','code','APPROVAL_REQUIRED');
  end if;
  select * into j from public.tailoring_jobs where id = p_job;
  if found then
    if j.user_id <> p_user then return jsonb_build_object('error','Invalid request ID'); end if;
    if j.state = 'completed' then return jsonb_build_object('result',j.result); end if;
    if j.state = 'running' and j.created_at > now() - interval '20 minutes' then
      return jsonb_build_object('error','This resume is still being generated','busy',true);
    end if;
    delete from public.tailoring_jobs where id = p_job;
  end if;
  if not full_access then
    if p_ip_key is null or p_ip_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid IP quota key'; end if;
    select count(*) into used from public.tailoring_jobs where user_id = p_user and
      (state = 'completed' or (state = 'running' and created_at > now() - interval '20 minutes'));
    if used >= 4 then
      return jsonb_build_object('error','Your four free resumes have been used. Request admin approval to continue.','code','ACCOUNT_LIMIT');
    end if;
    -- A shared row lock serializes requests from different accounts on the same IP/day.
    insert into public.trial_ip_buckets(ip_key,quota_day) values(p_ip_key,day_utc) on conflict do nothing;
    perform 1 from public.trial_ip_buckets where ip_key = p_ip_key and quota_day = day_utc for update;
    select count(*) into daily_used from public.tailoring_jobs where ip_key = p_ip_key and quota_day = day_utc and
      (state = 'completed' or (state = 'running' and created_at > now() - interval '20 minutes'));
    if daily_used >= 4 then
      return jsonb_build_object('error','This network has used its four free resumes today. Try after midnight UTC or request admin approval.','code','IP_DAILY_LIMIT',
        'resetAt', (day_utc + 1)::timestamp at time zone 'UTC');
    end if;
  end if;
  insert into public.tailoring_jobs(id,user_id,state,ip_key,quota_day)
    values(p_job,p_user,'running',case when full_access then null else p_ip_key end,case when full_access then null else day_utc end);
  return jsonb_build_object('reserved',true);
end $$;
revoke all on function public.reserve_tailoring(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reserve_tailoring(uuid,uuid,text) to service_role;

create or replace function public.trial_allowance(p_user uuid, p_ip_key text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'used', (select count(*) from public.tailoring_jobs where user_id = p_user and state = 'completed'),
    'accountRemaining', greatest(0, 4 - (select count(*) from public.tailoring_jobs where user_id = p_user and
      (state = 'completed' or (state = 'running' and created_at > now() - interval '20 minutes')))),
    'ipRemaining', greatest(0, 4 - (select count(*) from public.tailoring_jobs where ip_key = p_ip_key and quota_day = (now() at time zone 'UTC')::date and
      (state = 'completed' or (state = 'running' and created_at > now() - interval '20 minutes')))),
    'ipResetAt', (((now() at time zone 'UTC')::date + 1)::timestamp at time zone 'UTC')
  );
$$;
revoke all on function public.trial_allowance(uuid,text) from public, anon, authenticated;
grant execute on function public.trial_allowance(uuid,text) to service_role;

commit;
