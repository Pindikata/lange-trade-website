create extension if not exists pgcrypto;
create table if not exists public.trade_enquiries (
id uuid primary key default gen_random_uuid(),
reference text unique not null,
full_name text not null,
company text,
email text not null,
phone text not null,
country text not null,
destination text not null,
product text not null,
quantity text not null,
timeline text,
budget text,
incoterm text,
details text not null,
attachment_path text,
status text not null default 'New',
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
);
alter table public.trade_enquiries enable row level security;
create policy "public can submit trade enquiries" on public.trade_enquiries for insert to anon with check (true);
create policy "authenticated can read enquiries" on public.trade_enquiries for select to authenticated using (true);
create policy "authenticated can update enquiries" on public.trade_enquiries for update to authenticated using (true) with check (true);
insert into storage.buckets (id,name,public,file_size_limit) values ('enquiry-attachments','enquiry-attachments',false,10485760) on conflict(id) do nothing;
create policy "public can upload enquiry attachments" on storage.objects for insert to anon with check (bucket_id='enquiry-attachments');
create policy "authenticated can view enquiry attachments" on storage.objects for select to authenticated using (bucket_id='enquiry-attachments');
