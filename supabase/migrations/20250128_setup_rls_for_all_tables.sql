-- Migration: Setup RLS policies for all business tables
-- Ensures all tables with org_id have proper RLS isolation

-- Helper function to create org isolation policy if not exists
create or replace function public.create_org_isolation_policy(
  table_name text,
  policy_name text
) returns void
language plpgsql
as $$
begin
  execute format('
    drop policy if exists %I on public.%I;
    
    create policy %I
    on public.%I
    for all
    using (
      org_id = (select org_id from public.profiles where id = auth.uid())
    )
    with check (
      org_id = (select org_id from public.profiles where id = auth.uid())
    );
  ', policy_name, table_name, policy_name, table_name);
end;
$$;

-- Enable RLS and create policies for all business tables

-- Products
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'products') then
    alter table public.products enable row level security;
    perform public.create_org_isolation_policy('products', 'products_org_isolation');
  end if;
end $$;

-- Employees
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'employees') then
    alter table public.employees enable row level security;
    perform public.create_org_isolation_policy('employees', 'employees_org_isolation');
  end if;
end $$;

-- Cuts
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cuts') then
    alter table public.cuts enable row level security;
    perform public.create_org_isolation_policy('cuts', 'cuts_org_isolation');
  end if;
end $$;

-- Cut bundles
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cut_bundles') then
    alter table public.cut_bundles enable row level security;
    perform public.create_org_isolation_policy('cut_bundles', 'cut_bundles_org_isolation');
  end if;
end $$;

-- Cut items
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'cut_items') then
    alter table public.cut_items enable row level security;
    perform public.create_org_isolation_policy('cut_items', 'cut_items_org_isolation');
  end if;
end $$;

-- Invoices
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoices') then
    alter table public.invoices enable row level security;
    perform public.create_org_isolation_policy('invoices', 'invoices_org_isolation');
  end if;
end $$;

-- Invoice lines
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invoice_lines') then
    alter table public.invoice_lines enable row level security;
    -- Invoice lines inherit org_id from invoices, so we check via join
    drop policy if exists "invoice_lines_org_isolation" on public.invoice_lines;
    create policy "invoice_lines_org_isolation"
    on public.invoice_lines
    for all
    using (
      exists (
        select 1 from public.invoices
        where invoices.id = invoice_lines.invoice_id
        and invoices.org_id = (select org_id from public.profiles where id = auth.uid())
      )
    )
    with check (
      exists (
        select 1 from public.invoices
        where invoices.id = invoice_lines.invoice_id
        and invoices.org_id = (select org_id from public.profiles where id = auth.uid())
      )
    );
  end if;
end $$;

-- Sewing assignments
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'sewing_assignments') then
    alter table public.sewing_assignments enable row level security;
    perform public.create_org_isolation_policy('sewing_assignments', 'sewing_assignments_org_isolation');
  end if;
end $$;

-- Packaging records
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'packaging_records') then
    alter table public.packaging_records enable row level security;
    perform public.create_org_isolation_policy('packaging_records', 'packaging_records_org_isolation');
  end if;
end $$;

-- Cleanup helper function (optional, can keep for future use)
-- drop function if exists public.create_org_isolation_policy(text, text);

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
