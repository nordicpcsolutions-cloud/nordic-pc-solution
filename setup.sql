-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- Create bookings table
create table if not exists bookings (
  id         bigserial primary key,
  first      text not null,
  last       text not null,
  email      text not null,
  phone      text,
  service    text not null,
  message    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

-- Allow anyone (customers) to INSERT
create policy "Public can insert bookings"
  on bookings for insert
  to anon
  with check (true);

-- Allow anyone to SELECT (admin reads via anon key too)
create policy "Public can read bookings"
  on bookings for select
  to anon
  using (true);

-- Allow UPDATE (admin changes status)
create policy "Public can update bookings"
  on bookings for update
  to anon
  using (true);

-- Allow DELETE (admin removes spam)
create policy "Public can delete bookings"
  on bookings for delete
  to anon
  using (true);

-- Enable Row Level Security (required for policies to work)
alter table bookings enable row level security;
