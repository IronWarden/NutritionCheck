-- Usage limits for the functions that call Claude, so one user (or a burst of
-- anonymous accounts) can't run up the API bill.

create table public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index ai_calls_user_kind_idx on public.ai_calls (user_id, kind, created_at desc);
create index ai_calls_created_idx on public.ai_calls (created_at);

-- No policies: users can't read or clear their own history. Only use_ai_quota writes here.
alter table public.ai_calls enable row level security;

-- Records one call and returns null, or returns which limit was hit ('hour', 'day' or
-- 'global') without recording it. Callable only with the service role, so a user can't
-- call it directly to use up the shared daily limit.
create function public.use_ai_quota(
  p_user uuid,
  p_kind text,
  p_per_hour int,
  p_per_day int,
  p_global_per_day int
) returns text
language plpgsql security definer set search_path = public as $$
begin
  -- Serialises concurrent calls from one user so a burst can't slip past the count.
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  if (select count(*) from ai_calls where created_at > now() - interval '1 day') >= p_global_per_day then
    return 'global';
  end if;
  if (select count(*) from ai_calls
      where user_id = p_user and kind = p_kind and created_at > now() - interval '1 hour') >= p_per_hour then
    return 'hour';
  end if;
  if (select count(*) from ai_calls
      where user_id = p_user and kind = p_kind and created_at > now() - interval '1 day') >= p_per_day then
    return 'day';
  end if;

  insert into ai_calls (user_id, kind) values (p_user, p_kind);
  return null;
end;
$$;

revoke execute on function public.use_ai_quota(uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.use_ai_quota(uuid, text, int, int, int) to service_role;
