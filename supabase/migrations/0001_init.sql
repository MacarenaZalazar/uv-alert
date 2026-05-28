-- 0001_init.sql
-- Push subscriptions for UV index alerts.

create extension if not exists pgcrypto;

create table push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    endpoint text unique not null,
    p256dh text not null,
    auth text not null,
    lat numeric(8,5) not null,
    lon numeric(8,5) not null,
    threshold numeric(4,1) not null default 3.0,
    last_uv numeric(4,1),
    last_notified_at timestamptz,
    last_polled_at timestamptz,
    user_agent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint lat_range check (lat between -90 and 90),
    constraint lon_range check (lon between -180 and 180)
);

create index push_subscriptions_grid_idx
    on push_subscriptions (round(lat::numeric, 1), round(lon::numeric, 1));

create index push_subscriptions_last_polled_idx
    on push_subscriptions (last_polled_at nulls first);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger push_subscriptions_set_updated_at
    before update on push_subscriptions
    for each row execute function set_updated_at();

alter table push_subscriptions enable row level security;

-- Deny-all by default: no policies created.
-- All access via Service Role key from server-side code only.

notify pgrst, 'reload schema';
