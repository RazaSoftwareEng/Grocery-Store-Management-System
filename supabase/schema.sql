-- =====================================================================
-- Grocery Store Management System - Supabase (Postgres) Schema  v2
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole
--   file -> Run. Safe to run again on an existing database: it only adds
--   missing tables/columns, replaces functions and policies, and never
--   deletes your data.
--
-- What it contains:
--   * Tables: catalog, sales (+ split payments, returns), purchases,
--     customer & supplier ledgers (khata), cash shifts, held bills,
--     stock counts, expense categories, manager approvals, audit log
--   * Row Level Security: manager (ADMIN) has full read access; counter
--     cashiers can only bill. All money/stock writes go through
--     SECURITY DEFINER functions that compute prices on the server.
--   * First-run accounts:  admin / admin@2026   and   cashier1 / 1234
--     Both are forced to change their password at first sign-in.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- PRE-FLIGHT: refuse to run if data would break the new unique rules
-- ---------------------------------------------------------------------
do $$
declare v text;
begin
  if to_regclass('public.products') is not null then
    select string_agg(format('"%s" x%s', sku, n), ', ') into v
      from (select sku, count(*) n from public.products where coalesce(sku, '') <> '' group by sku having count(*) > 1) d;
    if v is not null then
      raise exception 'Duplicate product SKUs found: %. Give each product a unique SKU, then run this script again.', v;
    end if;
    select string_agg(format('"%s" x%s', barcode, n), ', ') into v
      from (select barcode, count(*) n from public.products where coalesce(barcode, '') <> '' group by barcode having count(*) > 1) d;
    if v is not null then
      raise exception 'Duplicate product barcodes found: %. Give each product a unique barcode, then run this script again.', v;
    end if;
  end if;
  if to_regclass('public.customers') is not null then
    select string_agg(format('"%s" (%s)', ph, names), '; ') into v
      from (select regexp_replace(coalesce(phone, ''), '\D', '', 'g') ph, string_agg(name, ', ') names
              from public.customers
             where customer_id <> 'WALK-IN' and regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
             group by 1 having count(*) > 1) d;
    if v is not null then
      raise exception 'Customers share the same phone number: %. Fix or merge them, then run this script again.', v;
    end if;
  end if;
end $$;

-- Short readable IDs like PROD-1A2B3C4D
create or replace function public.gen_id(prefix text, len int default 8)
returns text language sql volatile set search_path = '' as $$
  select prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, len));
$$;

-- ---------------------------------------------------------------------
-- TABLES (original)
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  full_name   text,
  role        text not null default 'CASHIER' check (role in ('ADMIN', 'CASHIER')),
  email       text default '',
  status      text not null default 'ACTIVE',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.categories (
  category_id  text primary key default public.gen_id('CAT-', 6),
  name         text not null,
  description  text default '',
  status       text not null default 'ACTIVE',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.products (
  product_id     text primary key default public.gen_id('PROD-'),
  name           text not null,
  sku            text,
  barcode        text default '',
  category_id    text references public.categories(category_id) on delete set null,
  unit           text default 'piece',
  cost_price     numeric(12,2) not null default 0,
  selling_price  numeric(12,2) not null default 0,
  current_stock  numeric(12,3) not null default 0,
  minimum_stock  numeric(12,3) not null default 5,
  expiry_date    date,
  status         text not null default 'ACTIVE',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_category_idx on public.products (category_id);

create table if not exists public.customers (
  customer_id          text primary key default public.gen_id('CUST-', 6),
  name                 text not null,
  phone                text default '',
  email                text default '',
  address              text default '',
  outstanding_balance  numeric(12,2) not null default 0,
  credit_limit         numeric(12,2) not null default 10000,
  status               text not null default 'ACTIVE',
  notes                text default '',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.suppliers (
  supplier_id          text primary key default public.gen_id('SUPP-', 6),
  name                 text not null,
  contact_person       text default '',
  phone                text default '',
  email                text default '',
  address              text default '',
  outstanding_balance  numeric(12,2) not null default 0,
  status               text not null default 'ACTIVE',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.sales (
  sale_id         text primary key default public.gen_id('SALE-'),
  invoice_number  text not null unique,
  date            timestamptz not null default now(),
  cashier_id      text,
  cashier_name    text,
  customer_id     text default 'WALK-IN',
  customer_name   text default 'Walk-in Customer',
  subtotal        numeric(12,2) not null default 0,
  discount        numeric(12,2) not null default 0,
  tax             numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  amount_paid     numeric(12,2) not null default 0,
  change          numeric(12,2) not null default 0,
  payment_method  text not null default 'CASH',
  payment_status  text not null default 'PAID',
  status          text not null default 'COMPLETED',
  notes           text default '',
  created_at      timestamptz not null default now()
);
create index if not exists sales_date_idx on public.sales (date desc);

create table if not exists public.sale_items (
  sale_item_id  text primary key default public.gen_id('SI-'),
  sale_id       text not null references public.sales(sale_id) on delete cascade,
  product_id    text,
  product_name  text,
  quantity      numeric(12,3) not null default 0,
  unit          text default 'piece',
  unit_price    numeric(12,2) not null default 0,
  unit_cost     numeric(12,2) not null default 0,
  discount      numeric(12,2) not null default 0,
  line_total    numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

create table if not exists public.purchases (
  purchase_id          text primary key default public.gen_id('PUR-'),
  purchase_number      text not null unique,
  date                 timestamptz not null default now(),
  supplier_id          text,
  supplier_name        text,
  subtotal             numeric(12,2) not null default 0,
  tax                  numeric(12,2) not null default 0,
  total                numeric(12,2) not null default 0,
  amount_paid          numeric(12,2) not null default 0,
  outstanding_balance  numeric(12,2) not null default 0,
  status               text not null default 'ORDERED',
  notes                text default '',
  created_at           timestamptz not null default now()
);

create table if not exists public.purchase_items (
  purchase_item_id  text primary key default public.gen_id('PI-'),
  purchase_id       text not null references public.purchases(purchase_id) on delete cascade,
  product_id        text,
  product_name      text,
  quantity          numeric(12,3) not null default 0,
  unit_cost         numeric(12,2) not null default 0,
  line_total        numeric(12,2) not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_product_idx on public.purchase_items (product_id);

create table if not exists public.expenses (
  expense_id      text primary key default public.gen_id('EXP-'),
  title           text not null,
  category        text default 'MISCELLANEOUS',
  amount          numeric(12,2) not null default 0,
  date            date not null default current_date,
  payment_method  text default 'CASH',
  reference       text default '',
  notes           text default '',
  created_by      text default '',
  created_at      timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses (date desc);

create table if not exists public.stock_movements (
  movement_id     text primary key default public.gen_id('MOV-'),
  product_id      text,
  movement_type   text not null,
  quantity        numeric(12,3) not null default 0,
  previous_stock  numeric(12,3) not null default 0,
  new_stock       numeric(12,3) not null default 0,
  reference_type  text,
  reference_id    text,
  reason          text default '',
  created_by      text default '',
  created_at      timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);

create table if not exists public.settings (
  key          text primary key,
  value        text,
  description  text default '',
  updated_at   timestamptz not null default now()
);

create table if not exists public.audit_logs (
  log_id      text primary key default public.gen_id('AUD-'),
  created_at  timestamptz not null default now(),
  user_id     text default 'SYSTEM',
  user_name   text default '',
  action      text not null,
  entity      text,
  entity_id   text,
  details     jsonb default '{}'::jsonb
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_user_idx on public.audit_logs (user_id, action, created_at desc);

-- ---------------------------------------------------------------------
-- NEW COLUMNS ON EXISTING TABLES
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists manager_pin          text,
  add column if not exists last_login_at        timestamptz,
  add column if not exists permissions          jsonb not null default '{}'::jsonb;

alter table public.customers
  add column if not exists phone_digits text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

alter table public.sales
  add column if not exists shift_id            text,
  add column if not exists credit_amount       numeric(12,2) not null default 0,
  add column if not exists credit_returned     numeric(12,2) not null default 0,
  add column if not exists returned_total      numeric(12,2) not null default 0,
  add column if not exists line_discount_total numeric(12,2) not null default 0,
  add column if not exists approved_by         text default '';
create index if not exists sales_shift_idx on public.sales (shift_id);
create index if not exists sales_cashier_idx on public.sales (cashier_id, date desc);
create index if not exists sales_customer_idx on public.sales (customer_id, date desc);

alter table public.sale_items
  add column if not exists returned_qty numeric(12,3) not null default 0;

alter table public.purchases
  add column if not exists received_total   numeric(12,2) not null default 0,
  add column if not exists returned_total   numeric(12,2) not null default 0,
  add column if not exists received_at      timestamptz,
  add column if not exists cancelled_reason text default '',
  add column if not exists created_by       text default '',
  add column if not exists updated_at       timestamptz not null default now();
alter table public.purchases alter column status set default 'ORDERED';

alter table public.purchase_items
  add column if not exists received_qty numeric(12,3) not null default 0,
  add column if not exists returned_qty numeric(12,3) not null default 0;

alter table public.expenses
  add column if not exists status           text not null default 'ACTIVE',
  add column if not exists void_reason      text default '',
  add column if not exists voided_at        timestamptz,
  add column if not exists voided_by        text default '',
  add column if not exists shift_id         text,
  add column if not exists paid_from_drawer boolean not null default false,
  add column if not exists created_by_id    uuid,
  add column if not exists updated_at       timestamptz not null default now();
alter table public.expenses alter column created_by set default '';

alter table public.stock_movements
  add column if not exists created_by_id uuid;

-- ---------------------------------------------------------------------
-- NEW TABLES
-- ---------------------------------------------------------------------

create table if not exists public.customer_ledger (
  entry_id        text primary key default public.gen_id('CL-'),
  customer_id     text not null references public.customers(customer_id) on delete cascade,
  type            text not null check (type in ('SALE_CREDIT', 'PAYMENT', 'RETURN', 'ADJUSTMENT', 'OPENING')),
  debit           numeric(12,2) not null default 0,
  credit          numeric(12,2) not null default 0,
  balance_after   numeric(12,2) not null default 0,
  reference       text default '',
  payment_method  text default '',
  notes           text default '',
  shift_id        text,
  created_by      text default '',
  created_by_id   uuid,
  created_at      timestamptz not null default now()
);
create index if not exists customer_ledger_customer_idx on public.customer_ledger (customer_id, created_at);
create index if not exists customer_ledger_shift_idx on public.customer_ledger (shift_id);

create table if not exists public.supplier_ledger (
  entry_id        text primary key default public.gen_id('SL-'),
  supplier_id     text not null references public.suppliers(supplier_id) on delete cascade,
  type            text not null check (type in ('PURCHASE', 'PAYMENT', 'RETURN', 'OPENING', 'ADJUSTMENT')),
  debit           numeric(12,2) not null default 0,
  credit          numeric(12,2) not null default 0,
  balance_after   numeric(12,2) not null default 0,
  purchase_id     text,
  reference       text default '',
  payment_method  text default '',
  notes           text default '',
  created_by      text default '',
  created_by_id   uuid,
  created_at      timestamptz not null default now()
);
create index if not exists supplier_ledger_supplier_idx on public.supplier_ledger (supplier_id, created_at);

create table if not exists public.sale_payments (
  payment_id  text primary key default public.gen_id('PAY-'),
  sale_id     text not null references public.sales(sale_id) on delete cascade,
  method      text not null check (method in ('CASH', 'CARD', 'ONLINE', 'CREDIT')),
  amount      numeric(12,2) not null default 0,
  tendered    numeric(12,2) not null default 0,
  reference   text default '',
  created_at  timestamptz not null default now()
);
create index if not exists sale_payments_sale_idx on public.sale_payments (sale_id);

create table if not exists public.sale_returns (
  return_id      text primary key default public.gen_id('RET-'),
  sale_id        text not null references public.sales(sale_id) on delete cascade,
  type           text not null default 'PARTIAL' check (type in ('PARTIAL', 'CANCEL')),
  items          jsonb not null default '[]'::jsonb,
  total          numeric(12,2) not null default 0,
  credit_amount  numeric(12,2) not null default 0,
  refund_amount  numeric(12,2) not null default 0,
  refund_method  text not null default 'CASH',
  reason         text default '',
  shift_id       text,
  approved_by    text default '',
  created_by     text default '',
  created_by_id  uuid,
  created_at     timestamptz not null default now()
);
create index if not exists sale_returns_sale_idx on public.sale_returns (sale_id);
create index if not exists sale_returns_shift_idx on public.sale_returns (shift_id);
create index if not exists sale_returns_created_idx on public.sale_returns (created_at desc);

create table if not exists public.held_bills (
  hold_id        text primary key default public.gen_id('HOLD-'),
  cashier_id     uuid not null default auth.uid(),
  cashier_name   text default '',
  customer       jsonb not null default '{}'::jsonb,
  cart           jsonb not null default '[]'::jsonb,
  bill_discount  numeric(12,2) not null default 0,
  note           text default '',
  created_at     timestamptz not null default now()
);
create index if not exists held_bills_cashier_idx on public.held_bills (cashier_id, created_at desc);

create table if not exists public.cash_shifts (
  shift_id       text primary key default public.gen_id('SHIFT-'),
  cashier_id     uuid not null,
  cashier_name   text default '',
  status         text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  opened_at      timestamptz not null default now(),
  opening_cash   numeric(12,2) not null default 0,
  closed_at      timestamptz,
  counted_cash   numeric(12,2),
  expected_cash  numeric(12,2),
  difference     numeric(12,2),
  notes          text default '',
  summary        jsonb,
  closed_by      text default ''
);
create unique index if not exists cash_shifts_one_open_idx on public.cash_shifts (cashier_id) where status = 'OPEN';
create index if not exists cash_shifts_opened_idx on public.cash_shifts (opened_at desc);

create table if not exists public.manager_approvals (
  token             uuid primary key default gen_random_uuid(),
  approved_by       uuid,
  approved_by_name  text default '',
  requested_by      uuid,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  used_at           timestamptz,
  used_for          text default ''
);

create table if not exists public.stock_counts (
  count_id       text primary key default public.gen_id('CNT-'),
  count_number   text not null unique,
  status         text not null default 'OPEN' check (status in ('OPEN', 'APPLIED', 'CANCELLED')),
  category_id    text,
  notes          text default '',
  created_by     text default '',
  created_by_id  uuid,
  created_at     timestamptz not null default now(),
  applied_at     timestamptz,
  applied_by     text default ''
);

create table if not exists public.stock_count_items (
  item_id       text primary key default public.gen_id('CNI-'),
  count_id      text not null references public.stock_counts(count_id) on delete cascade,
  product_id    text not null,
  product_name  text,
  sku           text default '',
  unit          text default 'piece',
  system_qty    numeric(12,3) not null default 0,
  counted_qty   numeric(12,3),
  unit_cost     numeric(12,2) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (count_id, product_id)
);

create table if not exists public.expense_categories (
  category_id  text primary key default public.gen_id('EXC-', 6),
  code         text not null unique,
  name         text not null,
  status       text not null default 'ACTIVE',
  sort_order   int not null default 100,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- DATA MIGRATIONS (each one is safe to run again)
-- ---------------------------------------------------------------------

-- Unique catalog codes and customer phone numbers
create unique index if not exists products_sku_key on public.products (sku) where coalesce(sku, '') <> '';
create unique index if not exists products_barcode_key on public.products (barcode) where coalesce(barcode, '') <> '';
create unique index if not exists customers_phone_digits_key on public.customers (phone_digits)
  where phone_digits <> '' and customer_id <> 'WALK-IN';

-- Old credit sales: everything not paid went to the khata
update public.sales set credit_amount = greatest(0, total - amount_paid)
 where payment_method = 'CREDIT' and credit_amount = 0 and total > amount_paid;

-- Old sales get one payment row so reports and receipts can rely on sale_payments
insert into public.sale_payments (sale_id, method, amount, tendered, created_at)
select s.sale_id,
       case when s.payment_method in ('CASH', 'CARD', 'ONLINE', 'CREDIT') then s.payment_method
            when s.payment_method = 'BANK_TRANSFER' then 'ONLINE' else 'CASH' end,
       case when s.payment_method = 'CREDIT' then s.credit_amount else s.total end,
       case when s.payment_method = 'CREDIT' then 0 else s.total + s.change end,
       s.created_at
  from public.sales s
 where s.payment_method <> 'SPLIT'
   and not exists (select 1 from public.sale_payments p where p.sale_id = s.sale_id);
insert into public.sale_payments (sale_id, method, amount, tendered, created_at)
select s.sale_id, 'CASH', s.amount_paid, s.amount_paid, s.created_at
  from public.sales s
 where s.payment_method = 'CREDIT' and s.amount_paid > 0
   and not exists (select 1 from public.sale_payments p where p.sale_id = s.sale_id and p.method = 'CASH');

-- Opening ledger rows for balances that existed before the ledger
insert into public.customer_ledger (customer_id, type, debit, credit, balance_after, reference, notes, created_by, created_at)
select c.customer_id, 'OPENING', greatest(c.outstanding_balance, 0), greatest(-c.outstanding_balance, 0),
       c.outstanding_balance, 'OPENING', 'Balance before ledger was enabled', 'SYSTEM', c.created_at
  from public.customers c
 where c.outstanding_balance <> 0
   and not exists (select 1 from public.customer_ledger l where l.customer_id = c.customer_id);
insert into public.supplier_ledger (supplier_id, type, debit, credit, balance_after, reference, notes, created_by, created_at)
select s.supplier_id, 'OPENING', greatest(s.outstanding_balance, 0), greatest(-s.outstanding_balance, 0),
       s.outstanding_balance, 'OPENING', 'Balance before ledger was enabled', 'SYSTEM', s.created_at
  from public.suppliers s
 where s.outstanding_balance <> 0
   and not exists (select 1 from public.supplier_ledger l where l.supplier_id = s.supplier_id);

-- Old purchase statuses: PENDING -> ORDERED, CONFIRMED -> RECEIVED
do $$
declare r record; v_bal numeric;
begin
  -- Advance payments on not-yet-received orders were never applied to the supplier balance
  perform set_config('app.ledger_write', 'on', true);
  for r in select p.* from public.purchases p
            where p.status = 'PENDING' and p.amount_paid > 0
              and exists (select 1 from public.suppliers s where s.supplier_id = p.supplier_id)
            order by p.created_at loop
    update public.suppliers set outstanding_balance = outstanding_balance - r.amount_paid
     where supplier_id = r.supplier_id returning outstanding_balance into v_bal;
    insert into public.supplier_ledger (supplier_id, type, debit, credit, balance_after, purchase_id, reference, notes, created_by, created_at)
    values (r.supplier_id, 'PAYMENT', 0, r.amount_paid, v_bal, r.purchase_id, r.purchase_number,
            'Advance paid on order (migrated)', 'SYSTEM', r.created_at);
  end loop;
  perform set_config('app.ledger_write', 'off', true);

  update public.purchase_items pi set received_qty = pi.quantity
    from public.purchases p where p.purchase_id = pi.purchase_id and p.status = 'CONFIRMED' and pi.received_qty = 0;
  update public.purchases set received_total = total, received_at = coalesce(received_at, created_at)
   where status = 'CONFIRMED' and received_total = 0;
  update public.purchases set status = 'ORDERED' where status = 'PENDING';
  update public.purchases set status = 'RECEIVED' where status in ('CONFIRMED', 'COMPLETED');
end $$;

-- ---------------------------------------------------------------------
-- ACCESS HELPERS
-- ---------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and role = 'ADMIN');
$$;

create or replace function public.setting(p_key text, p_default text default null)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(value, '') from public.settings where key = p_key), p_default);
$$;

create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce(public.setting(p_key)::numeric, p_default);
exception when others then
  return p_default;
end $$;

-- One store time zone for invoice numbers, "today" and reports
create or replace function public.store_tz()
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text := public.setting('timezone', 'Asia/Karachi');
begin
  perform now() at time zone v;
  return v;
exception when others then
  return 'Asia/Karachi';
end $$;

create or replace function public.store_today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone public.store_tz())::date;
$$;

create or replace function public.current_staff_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select coalesce(nullif(full_name, ''), username) from public.profiles where id = auth.uid()), 'SYSTEM');
$$;

create or replace function public._my_open_shift()
returns text language sql stable security definer set search_path = '' as $$
  select shift_id from public.cash_shifts where cashier_id = auth.uid() and status = 'OPEN' limit 1;
$$;

create or replace function public._is_weighted_unit(p_unit text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(trim(coalesce(p_unit, ''))) in ('kg', 'kilogram', 'g', 'gm', 'gms', 'gram', 'grams',
                                                'l', 'ltr', 'litre', 'liter', 'ml', 'meter', 'metre', 'm');
$$;

-- Effective permissions of the signed-in user
create or replace function public.my_permissions()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_p public.profiles%rowtype;
begin
  select * into v_p from public.profiles where id = auth.uid() and status = 'ACTIVE';
  if not found then
    return jsonb_build_object('canGiveDiscount', false, 'maxDiscountPercent', 0, 'canReturn', false,
                              'canViewReports', false, 'isAdmin', false);
  end if;
  if v_p.role = 'ADMIN' then
    return jsonb_build_object('canGiveDiscount', true, 'maxDiscountPercent', 100, 'canReturn', true,
                              'canViewReports', true, 'isAdmin', true);
  end if;
  return jsonb_build_object('canGiveDiscount', true,
                            'maxDiscountPercent', public.setting_num('cashierMaxDiscountPercent', 10),
                            'canReturn', false, 'canViewReports', false)
         || jsonb_strip_nulls(coalesce(v_p.permissions, '{}'::jsonb))
         || jsonb_build_object('isAdmin', false);
end $$;

create or replace function public._perm_bool(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((public.my_permissions() ->> p_key)::boolean, false);
$$;

create or replace function public._require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only the store manager can do this';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- AUDIT (user always taken from the signed-in profile)
-- ---------------------------------------------------------------------

drop function if exists public.log_audit(text, text, text, text, jsonb);

create or replace function public.audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (user_id, user_name, action, entity, entity_id, details)
  values (coalesce(auth.uid()::text, 'SYSTEM'), public.current_staff_name(), p_action, p_entity, p_entity_id,
          coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- LEDGERS (khata). Balance = sum(debit) - sum(credit). Negative = advance.
-- ---------------------------------------------------------------------

create or replace function public._customer_ledger(p_customer_id text, p_type text, p_debit numeric, p_credit numeric,
                                                   p_reference text, p_method text, p_notes text, p_shift_id text default null)
returns public.customer_ledger language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric;
  v_row customer_ledger%rowtype;
begin
  perform set_config('app.ledger_write', 'on', true);
  update customers set outstanding_balance = outstanding_balance + coalesce(p_debit, 0) - coalesce(p_credit, 0),
                       updated_at = now()
   where customer_id = p_customer_id
  returning outstanding_balance into v_bal;
  perform set_config('app.ledger_write', 'off', true);
  if v_bal is null then raise exception 'Customer not found'; end if;

  insert into customer_ledger (customer_id, type, debit, credit, balance_after, reference, payment_method, notes,
                               shift_id, created_by, created_by_id)
  values (p_customer_id, p_type, coalesce(p_debit, 0), coalesce(p_credit, 0), v_bal, coalesce(p_reference, ''),
          coalesce(p_method, ''), coalesce(p_notes, ''), p_shift_id, current_staff_name(), auth.uid())
  returning * into v_row;
  return v_row;
end $$;

create or replace function public._supplier_ledger(p_supplier_id text, p_type text, p_debit numeric, p_credit numeric,
                                                   p_purchase_id text, p_reference text, p_method text, p_notes text)
returns public.supplier_ledger language plpgsql security definer set search_path = public as $$
declare
  v_bal numeric;
  v_row supplier_ledger%rowtype;
begin
  perform set_config('app.ledger_write', 'on', true);
  update suppliers set outstanding_balance = outstanding_balance + coalesce(p_debit, 0) - coalesce(p_credit, 0),
                       updated_at = now()
   where supplier_id = p_supplier_id
  returning outstanding_balance into v_bal;
  perform set_config('app.ledger_write', 'off', true);
  if v_bal is null then raise exception 'Supplier not found'; end if;

  insert into supplier_ledger (supplier_id, type, debit, credit, balance_after, purchase_id, reference, payment_method,
                               notes, created_by, created_by_id)
  values (p_supplier_id, p_type, coalesce(p_debit, 0), coalesce(p_credit, 0), v_bal, p_purchase_id,
          coalesce(p_reference, ''), coalesce(p_method, ''), coalesce(p_notes, ''), current_staff_name(), auth.uid())
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------

-- Balances only change through the ledger functions
create or replace function public._protect_balance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.outstanding_balance is distinct from old.outstanding_balance
     and coalesce(current_setting('app.ledger_write', true), '') <> 'on' then
    new.outstanding_balance := old.outstanding_balance;
  end if;
  return new;
end $$;
drop trigger if exists customers_protect_balance on public.customers;
create trigger customers_protect_balance before update on public.customers
  for each row execute function public._protect_balance();
drop trigger if exists suppliers_protect_balance on public.suppliers;
create trigger suppliers_protect_balance before update on public.suppliers
  for each row execute function public._protect_balance();

-- Cashiers may add customers, but never with credit or an opening balance
create or replace function public._customer_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.credit_limit := 0;
    new.outstanding_balance := 0;
  end if;
  return new;
end $$;
drop trigger if exists customers_before_insert on public.customers;
create trigger customers_before_insert before insert on public.customers
  for each row execute function public._customer_before_insert();

-- Opening balance on a new customer / supplier goes into the ledger
create or replace function public._opening_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.outstanding_balance <> 0 then
    if tg_table_name = 'customers' then
      insert into public.customer_ledger (customer_id, type, debit, credit, balance_after, reference, notes, created_by, created_by_id)
      values (new.customer_id, 'OPENING', greatest(new.outstanding_balance, 0), greatest(-new.outstanding_balance, 0),
              new.outstanding_balance, 'OPENING', 'Opening balance', public.current_staff_name(), auth.uid());
    else
      insert into public.supplier_ledger (supplier_id, type, debit, credit, balance_after, reference, notes, created_by, created_by_id)
      values (new.supplier_id, 'OPENING', greatest(new.outstanding_balance, 0), greatest(-new.outstanding_balance, 0),
              new.outstanding_balance, 'OPENING', 'Opening balance', public.current_staff_name(), auth.uid());
    end if;
  end if;
  return null;
end $$;
drop trigger if exists customers_opening_ledger on public.customers;
create trigger customers_opening_ledger after insert on public.customers
  for each row execute function public._opening_ledger();
drop trigger if exists suppliers_opening_ledger on public.suppliers;
create trigger suppliers_opening_ledger after insert on public.suppliers
  for each row execute function public._opening_ledger();

-- Products with sales or purchase history can only be deactivated
create or replace function public._product_before_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.sale_items where product_id = old.product_id)
     or exists (select 1 from public.purchase_items where product_id = old.product_id) then
    raise exception 'This product has sales or purchase history and cannot be deleted. Deactivate it instead.';
  end if;
  return old;
end $$;
drop trigger if exists products_before_delete on public.products;
create trigger products_before_delete before delete on public.products
  for each row execute function public._product_before_delete();

-- Held bills always belong to the signed-in cashier
create or replace function public._held_bill_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.cashier_id := auth.uid();
  new.cashier_name := public.current_staff_name();
  return new;
end $$;
drop trigger if exists held_bills_before_insert on public.held_bills;
create trigger held_bills_before_insert before insert on public.held_bills
  for each row execute function public._held_bill_before_insert();

-- Expenses: author from profile, drawer link to the open shift, void rules
create or replace function public._expense_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := public.current_staff_name();
    new.created_by_id := auth.uid();
    new.status := 'ACTIVE';
    new.voided_at := null;
  else
    if old.status = 'VOIDED' then
      raise exception 'A voided expense cannot be changed';
    end if;
    new.created_by := old.created_by;
    new.created_by_id := old.created_by_id;
    new.created_at := old.created_at;
    if new.status = 'VOIDED' then
      if length(trim(coalesce(new.void_reason, ''))) < 3 then
        raise exception 'Give a reason for voiding this expense';
      end if;
      new.voided_at := now();
      new.voided_by := public.current_staff_name();
    end if;
  end if;
  new.updated_at := now();
  if new.amount <= 0 then
    raise exception 'Expense amount must be greater than 0';
  end if;
  if new.paid_from_drawer then
    new.payment_method := 'CASH';
    if new.shift_id is null or (tg_op = 'UPDATE' and old.paid_from_drawer is distinct from true) then
      new.shift_id := coalesce(public._my_open_shift(),
                               (select shift_id from public.cash_shifts where status = 'OPEN' order by opened_at desc limit 1));
      if new.shift_id is null then
        raise exception 'No cash drawer shift is open. Open a shift first, or untick "Paid from cash drawer".';
      end if;
    end if;
  else
    new.shift_id := null;
  end if;
  return new;
end $$;
drop trigger if exists expenses_before_write on public.expenses;
create trigger expenses_before_write before insert or update on public.expenses
  for each row execute function public._expense_before_write();

create or replace function public._expense_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit('EXPENSE_CREATE', 'EXPENSE', new.expense_id, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    perform public.audit(case when new.status = 'VOIDED' and old.status <> 'VOIDED' then 'EXPENSE_VOID' else 'EXPENSE_UPDATE' end,
                         'EXPENSE', new.expense_id, jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
  else
    perform public.audit('EXPENSE_DELETE', 'EXPENSE', old.expense_id, to_jsonb(old));
  end if;
  return null;
end $$;
drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public._expense_audit();

-- ---------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

-- Store manager (ADMIN): full access to every table (writes to money/stock
-- tables are additionally revoked below so they only happen through functions)
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','customers','suppliers','sales','sale_items',
    'purchases','purchase_items','expenses','stock_movements','settings','audit_logs',
    'customer_ledger','supplier_ledger','sale_payments','sale_returns','held_bills','cash_shifts',
    'stock_counts','stock_count_items','expense_categories','manager_approvals'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff full access" on public.%I', t);
    execute format('drop policy if exists "admin full access" on public.%I', t);
    if t <> 'manager_approvals' then
      execute format(
        'create policy "admin full access" on public.%I for all to authenticated
           using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    end if;
  end loop;
end $$;

-- Counter cashier: read the catalog and settings
do $$
declare t text;
begin
  foreach t in array array['products', 'categories', 'customers', 'settings', 'expense_categories'] loop
    execute format('drop policy if exists "staff read" on public.%I', t);
    execute format(
      'create policy "staff read" on public.%I for select to authenticated using ((select public.is_staff()))', t);
  end loop;
end $$;

drop policy if exists "staff add customers" on public.customers;
create policy "staff add customers" on public.customers for insert to authenticated
  with check ((select public.is_staff()));

drop policy if exists "cashier own sales" on public.sales;
create policy "cashier own sales" on public.sales for select to authenticated
  using ((select public.is_staff()) and cashier_id = (select auth.uid())::text);

drop policy if exists "cashier own sale items" on public.sale_items;
create policy "cashier own sale items" on public.sale_items for select to authenticated
  using ((select public.is_staff()) and exists (
    select 1 from public.sales s where s.sale_id = sale_items.sale_id and s.cashier_id = (select auth.uid())::text));

drop policy if exists "cashier own sale payments" on public.sale_payments;
create policy "cashier own sale payments" on public.sale_payments for select to authenticated
  using ((select public.is_staff()) and exists (
    select 1 from public.sales s where s.sale_id = sale_payments.sale_id and s.cashier_id = (select auth.uid())::text));

drop policy if exists "cashier own sale returns" on public.sale_returns;
create policy "cashier own sale returns" on public.sale_returns for select to authenticated
  using ((select public.is_staff()) and exists (
    select 1 from public.sales s where s.sale_id = sale_returns.sale_id and s.cashier_id = (select auth.uid())::text));

drop policy if exists "cashier own shifts" on public.cash_shifts;
create policy "cashier own shifts" on public.cash_shifts for select to authenticated
  using ((select public.is_staff()) and cashier_id = (select auth.uid()));

drop policy if exists "cashier own held bills" on public.held_bills;
create policy "cashier own held bills" on public.held_bills for all to authenticated
  using ((select public.is_staff()) and cashier_id = (select auth.uid()))
  with check ((select public.is_staff()) and cashier_id = (select auth.uid()));

-- Anonymous visitors (login screen) get only the store name and tagline,
-- through public_store_info(). No direct table access.
drop policy if exists "public read settings" on public.settings;

-- Profiles: admin sees all staff, everyone sees themselves; changes only via functions
alter table public.profiles enable row level security;
drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated
  using ((select public.is_admin()) or id = (select auth.uid()));

grant usage on schema public to anon, authenticated;
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
-- Money, stock and audit records are written only by the functions below
revoke insert, update, delete on
  public.products, public.sales, public.sale_items, public.sale_payments, public.sale_returns,
  public.purchases, public.purchase_items, public.stock_movements, public.audit_logs,
  public.customer_ledger, public.supplier_ledger, public.cash_shifts, public.manager_approvals,
  public.stock_counts
from authenticated;
revoke delete on public.expenses from authenticated;
revoke all on public.manager_approvals from authenticated;

-- Realtime stock updates across counters
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products') then
    execute 'alter publication supabase_realtime add table public.products';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- DROP FUNCTIONS WHOSE SIGNATURE CHANGED (recreated below)
-- ---------------------------------------------------------------------
drop function if exists public.cancel_sale(text, text, text);
drop function if exists public.adjust_stock(text, text, numeric, text, text);
drop function if exists public.record_customer_payment(text, numeric);
drop function if exists public.record_supplier_payment(text, numeric, text);
drop function if exists public.dashboard_stats(text);
drop function if exists public.report_stats(date, date, text);
drop function if exists public.admin_save_user(uuid, text, text, text, text, text, text);

-- ---------------------------------------------------------------------
-- PUBLIC + SESSION FUNCTIONS
-- ---------------------------------------------------------------------

create or replace function public.public_store_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('storeName', public.setting('storeName', 'Grocery Store'),
                            'tagline', public.setting('tagline', ''));
$$;

create or replace function public._profile_json(p public.profiles)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'full_name', p.full_name, 'role', p.role,
                            'email', p.email, 'status', p.status, 'created_at', p.created_at,
                            'must_change_password', p.must_change_password, 'last_login_at', p.last_login_at,
                            'permissions', p.permissions, 'has_manager_pin', p.manager_pin is not null);
$$;

-- Called right after a successful sign-in
create or replace function public.record_login()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v public.profiles%rowtype;
begin
  update public.profiles set last_login_at = now() where id = auth.uid() and status = 'ACTIVE' returning * into v;
  if not found then raise exception 'No active staff profile for this account'; end if;
  perform public.audit('LOGIN', 'PROFILE', v.id::text, '{}'::jsonb);
  return public._profile_json(v) || jsonb_build_object('effective_permissions', public.my_permissions());
end $$;

create or replace function public.my_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.profiles%rowtype;
begin
  select * into v from public.profiles where id = auth.uid() and status = 'ACTIVE';
  if not found then return null; end if;
  return public._profile_json(v) || jsonb_build_object('effective_permissions', public.my_permissions());
end $$;

create or replace function public.verify_own_password(p_password text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u join public.profiles p on p.id = u.id
                  where u.id = auth.uid() and p.status = 'ACTIVE'
                    and u.encrypted_password = extensions.crypt(coalesce(p_password, ''), u.encrypted_password));
$$;

create or replace function public.change_own_password(p_old text, p_new text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.verify_own_password(p_old) then
    raise exception 'Current password is not correct';
  end if;
  if length(coalesce(p_new, '')) < 6 then
    raise exception 'New password must be at least 6 characters';
  end if;
  if p_new = p_old then
    raise exception 'New password must be different from the current one';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_new, extensions.gen_salt('bf')), updated_at = now()
   where id = auth.uid();
  update public.profiles set must_change_password = false, updated_at = now() where id = auth.uid();
  perform public.audit('CHANGE_OWN_PASSWORD', 'PROFILE', auth.uid()::text, '{}'::jsonb);
end $$;

-- Manager PIN (admins only). Stored as a bcrypt hash.
create or replace function public.set_manager_pin(p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_admin();
  if coalesce(p_pin, '') !~ '^\d{4,8}$' then
    raise exception 'Manager PIN must be 4 to 8 digits';
  end if;
  update public.profiles set manager_pin = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now()
   where id = auth.uid();
  perform public.audit('SET_MANAGER_PIN', 'PROFILE', auth.uid()::text, '{}'::jsonb);
end $$;

-- Any signed-in staff member can ask a manager to type the PIN.
-- Returns a single-use approval token valid for 5 minutes.
create or replace function public.verify_manager_pin(p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_fail   int;
  v_admin  public.profiles%rowtype;
  v_token  uuid;
  v_exp    timestamptz := now() + interval '5 minutes';
  v_name   text;
begin
  if not public.is_staff() then raise exception 'Please sign in first'; end if;
  select count(*) into v_fail from public.audit_logs
   where user_id = auth.uid()::text and action = 'MANAGER_PIN_FAILED' and created_at > now() - interval '15 minutes';
  if v_fail >= 5 then
    return jsonb_build_object('success', false, 'error', 'Too many wrong PIN attempts. Try again in 15 minutes.');
  end if;

  select * into v_admin from public.profiles
   where role = 'ADMIN' and status = 'ACTIVE' and manager_pin is not null
     and manager_pin = extensions.crypt(coalesce(p_pin, ''), manager_pin)
   limit 1;
  if not found then
    perform public.audit('MANAGER_PIN_FAILED', 'PROFILE', auth.uid()::text, '{}'::jsonb);
    return jsonb_build_object('success', false, 'error', 'Wrong manager PIN');
  end if;

  v_name := coalesce(nullif(v_admin.full_name, ''), v_admin.username);
  insert into public.manager_approvals (approved_by, approved_by_name, requested_by, expires_at)
  values (v_admin.id, v_name, auth.uid(), v_exp)
  returning token into v_token;
  perform public.audit('MANAGER_PIN_APPROVED', 'PROFILE', v_admin.id::text,
                       jsonb_build_object('requestedBy', public.current_staff_name()));
  return jsonb_build_object('success', true, 'token', v_token, 'approvedBy', v_name, 'expiresAt', v_exp);
end $$;

create or replace function public._consume_approval(p_token text, p_purpose text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if coalesce(p_token, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Manager approval is missing or invalid. Ask the manager to enter the PIN again.';
  end if;
  update public.manager_approvals set used_at = now(), used_for = p_purpose
   where token = p_token::uuid and requested_by = auth.uid() and used_at is null and expires_at > now()
  returning approved_by_name into v_name;
  if v_name is null then
    raise exception 'Manager approval expired or was already used. Ask the manager to enter the PIN again.';
  end if;
  return v_name;
end $$;

-- ---------------------------------------------------------------------
-- CASH SHIFTS
-- ---------------------------------------------------------------------

create or replace function public.shift_summary(p_shift_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_shift cash_shifts%rowtype;
  v jsonb;
begin
  select * into v_shift from cash_shifts where shift_id = p_shift_id;
  if not found then raise exception 'Shift not found'; end if;
  if not is_admin() and not _perm_bool('canViewReports') and v_shift.cashier_id is distinct from auth.uid() then
    raise exception 'You can only see your own shift';
  end if;

  with s as (select * from sales where shift_id = p_shift_id),
  pay as (select sp.method, sum(sp.amount) amt from sale_payments sp join s on s.sale_id = sp.sale_id group by sp.method),
  ret as (select refund_method, sum(refund_amount) amt from sale_returns where shift_id = p_shift_id group by refund_method),
  k as (select coalesce(sum(credit), 0) amt from customer_ledger
         where shift_id = p_shift_id and type = 'PAYMENT' and payment_method = 'CASH'),
  e as (select coalesce(sum(amount), 0) amt, count(*) cnt from expenses where shift_id = p_shift_id and status = 'ACTIVE'),
  t as (select
          coalesce((select amt from pay where method = 'CASH'), 0) cash,
          coalesce((select amt from pay where method = 'CARD'), 0) card,
          coalesce((select amt from pay where method = 'ONLINE'), 0) online,
          coalesce((select amt from pay where method = 'CREDIT'), 0) credit,
          coalesce((select amt from ret where refund_method = 'CASH'), 0) cash_refunds,
          coalesce((select sum(amt) from ret where refund_method <> 'CASH'), 0) other_refunds,
          (select amt from k) khata_cash,
          (select amt from e) expenses_cash,
          (select cnt from e) expenses_count)
  select jsonb_build_object(
    'shiftId', v_shift.shift_id,
    'cashierName', v_shift.cashier_name,
    'openedAt', v_shift.opened_at,
    'closedAt', v_shift.closed_at,
    'openingCash', v_shift.opening_cash,
    'billCount', (select count(*) from s where status = 'COMPLETED'),
    'cancelledCount', (select count(*) from s where status = 'CANCELLED'),
    'salesTotal', (select coalesce(sum(total), 0) from s),
    'discountTotal', (select coalesce(sum(discount + line_discount_total), 0) from s),
    'cashSales', t.cash, 'cardSales', t.card, 'onlineSales', t.online, 'creditSales', t.credit,
    'cashRefunds', t.cash_refunds, 'otherRefunds', t.other_refunds,
    'returnsCount', (select count(*) from sale_returns where shift_id = p_shift_id),
    'khataCollections', t.khata_cash,
    'cashExpenses', t.expenses_cash, 'expensesCount', t.expenses_count,
    'expectedCash', v_shift.opening_cash + t.cash - t.cash_refunds + t.khata_cash - t.expenses_cash,
    'countedCash', v_shift.counted_cash,
    'difference', v_shift.difference)
  into v from t;
  return v;
end $$;

create or replace function public.current_shift()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_id text := _my_open_shift();
begin
  if v_id is null then return null; end if;
  return shift_summary(v_id);
end $$;

create or replace function public.open_shift(p_opening_cash numeric, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if not is_staff() then raise exception 'Please sign in first'; end if;
  if _my_open_shift() is not null then raise exception 'You already have an open shift'; end if;
  if coalesce(p_opening_cash, 0) < 0 then raise exception 'Opening cash cannot be negative'; end if;
  insert into cash_shifts (cashier_id, cashier_name, opening_cash, notes)
  values (auth.uid(), current_staff_name(), round(coalesce(p_opening_cash, 0), 2), coalesce(p_notes, ''))
  returning shift_id into v_id;
  perform audit('OPEN_SHIFT', 'SHIFT', v_id, jsonb_build_object('openingCash', p_opening_cash));
  return shift_summary(v_id);
end $$;

create or replace function public.close_shift(p_shift_id text, p_counted_cash numeric, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shift cash_shifts%rowtype;
  v_sum jsonb;
  v_expected numeric;
begin
  select * into v_shift from cash_shifts where shift_id = coalesce(p_shift_id, _my_open_shift()) for update;
  if not found then raise exception 'No open shift found'; end if;
  if v_shift.status <> 'OPEN' then raise exception 'This shift is already closed'; end if;
  if not is_admin() and v_shift.cashier_id <> auth.uid() then raise exception 'You can only close your own shift'; end if;
  if p_counted_cash is null or p_counted_cash < 0 then raise exception 'Enter the cash counted in the drawer'; end if;

  v_sum := shift_summary(v_shift.shift_id);
  v_expected := (v_sum->>'expectedCash')::numeric;
  update cash_shifts
     set status = 'CLOSED', closed_at = now(), counted_cash = round(p_counted_cash, 2),
         expected_cash = v_expected, difference = round(p_counted_cash, 2) - v_expected,
         notes = trim(both ' ' from coalesce(notes, '') || ' ' || coalesce(p_notes, '')),
         closed_by = current_staff_name()
   where shift_id = v_shift.shift_id;
  v_sum := shift_summary(v_shift.shift_id);
  update cash_shifts set summary = v_sum where shift_id = v_shift.shift_id;
  perform audit('CLOSE_SHIFT', 'SHIFT', v_shift.shift_id,
                jsonb_build_object('expected', v_expected, 'counted', p_counted_cash, 'difference', p_counted_cash - v_expected));
  return v_sum;
end $$;

-- ---------------------------------------------------------------------
-- POS: CREATE SALE. The server reads every price from products and
-- computes subtotal -> discount -> tax -> total. Client totals are ignored.
--   p = { customerId, items:[{productId, quantity, discount}], discount (bill),
--         payments:[{method, amount, reference}], notes, approvalToken }
-- ---------------------------------------------------------------------

create or replace function public.create_sale(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid             uuid := auth.uid();
  v_profile         profiles%rowtype;
  v_perms           jsonb;
  v_items           jsonb := coalesce(p->'items', '[]'::jsonb);
  v_item            jsonb;
  v_prod            products%rowtype;
  v_allow_negative  boolean := setting('allowNegativeStock', 'false') = 'true';
  v_tax_rate        numeric := setting_num('taxRate', 0);
  v_qty             numeric;
  v_gross           numeric;
  v_ldisc           numeric;
  v_lines           jsonb := '[]'::jsonb;
  v_line            jsonb;
  v_gross_total     numeric := 0;
  v_subtotal        numeric := 0;
  v_line_disc_total numeric := 0;
  v_bill_disc       numeric := round(coalesce(nullif(p->>'discount', '')::numeric, 0), 2);
  v_tax             numeric;
  v_total           numeric;
  v_disc_pct        numeric;
  v_max_pct         numeric;
  v_need            text[] := '{}';
  v_approved_by     text := '';
  v_payments        jsonb := p->'payments';
  v_pay             jsonb;
  v_method          text;
  v_amt             numeric;
  v_cash            numeric := 0;
  v_card            numeric := 0;
  v_online          numeric := 0;
  v_has_credit      boolean := false;
  v_credit          numeric := 0;
  v_change          numeric := 0;
  v_refs            jsonb := '{}'::jsonb;
  v_tenders         text[] := '{}';
  v_customer_id     text := coalesce(nullif(p->>'customerId', ''), 'WALK-IN');
  v_customer        customers%rowtype;
  v_customer_name   text := 'Walk-in Customer';
  v_bal_before      numeric := 0;
  v_bal_after       numeric := 0;
  v_shift_id        text;
  v_name            text;
  v_now             timestamptz := now();
  v_prefix          text;
  v_seq             int;
  v_invoice         text;
  v_sale            sales%rowtype;
  v_si              sale_items%rowtype;
  v_items_out       jsonb := '[]'::jsonb;
begin
  select * into v_profile from profiles where id = v_uid and status = 'ACTIVE';
  if not found then raise exception 'Please sign in to record sales'; end if;
  v_name := coalesce(nullif(v_profile.full_name, ''), v_profile.username);
  v_perms := my_permissions();

  v_shift_id := _my_open_shift();
  if v_shift_id is null and v_profile.role <> 'ADMIN' then
    raise exception 'Open your shift before billing';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Cannot checkout with an empty cart';
  end if;
  if v_bill_disc < 0 then raise exception 'Discount cannot be negative'; end if;

  -- 1. Lines: lock each product (sorted, no deadlocks), price from the database
  for v_item in
    select jsonb_build_object('productId', x->>'productId',
                              'quantity', sum(coalesce(nullif(x->>'quantity', '')::numeric, 0)),
                              'discount', sum(coalesce(nullif(x->>'discount', '')::numeric, 0)))
      from jsonb_array_elements(v_items) x
     group by x->>'productId'
     order by x->>'productId'
  loop
    select * into v_prod from products where product_id = v_item->>'productId' for update;
    if not found then raise exception 'Product not found: %', v_item->>'productId'; end if;
    if v_prod.status = 'INACTIVE' then raise exception '"%" is inactive and cannot be sold', v_prod.name; end if;
    v_qty := round((v_item->>'quantity')::numeric, 3);
    if v_qty <= 0 then raise exception 'Invalid quantity for "%"', v_prod.name; end if;
    if not _is_weighted_unit(v_prod.unit) and v_qty <> trunc(v_qty) then
      raise exception '"%" is sold per %, so the quantity must be a whole number', v_prod.name, coalesce(v_prod.unit, 'piece');
    end if;
    if not v_allow_negative and v_prod.current_stock < v_qty then
      raise exception 'Insufficient stock for "%". Available: %, Requested: %', v_prod.name, v_prod.current_stock, v_qty;
    end if;
    v_gross := round(v_prod.selling_price * v_qty, 2);
    v_ldisc := round((v_item->>'discount')::numeric, 2);
    if v_ldisc < 0 then raise exception 'Discount on "%" cannot be negative', v_prod.name; end if;
    if v_ldisc > v_gross then raise exception 'Discount on "%" is more than the line amount', v_prod.name; end if;

    v_gross_total := v_gross_total + v_gross;
    v_line_disc_total := v_line_disc_total + v_ldisc;
    v_subtotal := v_subtotal + v_gross - v_ldisc;
    v_lines := v_lines || jsonb_build_object('productId', v_prod.product_id, 'name', v_prod.name, 'qty', v_qty,
                                             'unit', coalesce(v_prod.unit, 'piece'), 'price', v_prod.selling_price,
                                             'cost', v_prod.cost_price, 'discount', v_ldisc,
                                             'lineTotal', v_gross - v_ldisc, 'stock', v_prod.current_stock);
  end loop;

  if v_bill_disc > v_subtotal then raise exception 'Bill discount cannot be more than the subtotal'; end if;

  -- 2. Discount limit for this user
  if v_line_disc_total + v_bill_disc > 0 then
    v_disc_pct := (v_line_disc_total + v_bill_disc) / nullif(v_gross_total, 0) * 100;
    v_max_pct := case when coalesce((v_perms->>'canGiveDiscount')::boolean, false)
                      then coalesce((v_perms->>'maxDiscountPercent')::numeric, 0) else 0 end;
    if coalesce(v_disc_pct, 0) > v_max_pct + 0.001 then
      v_need := v_need || format('Discount of %s%% is over your limit of %s%%', round(v_disc_pct, 1), round(v_max_pct, 1));
    end if;
  end if;

  -- 3. Tax on the discounted amount, then total
  v_tax := round((v_subtotal - v_bill_disc) * v_tax_rate / 100, 2);
  v_total := v_subtotal - v_bill_disc + v_tax;

  -- 4. Tenders
  if v_payments is null or jsonb_typeof(v_payments) <> 'array' or jsonb_array_length(v_payments) = 0 then
    v_method := upper(coalesce(nullif(p->>'paymentMethod', ''), 'CASH'));
    v_amt := nullif(p->>'amountPaid', '')::numeric;
    if v_method = 'CREDIT' then
      v_payments := jsonb_build_array(jsonb_build_object('method', 'CREDIT'));
      if coalesce(v_amt, 0) > 0 then
        v_payments := v_payments || jsonb_build_object('method', 'CASH', 'amount', v_amt);
      end if;
    else
      v_payments := jsonb_build_array(jsonb_build_object('method', v_method, 'amount', coalesce(v_amt, v_total)));
    end if;
  end if;

  for v_pay in select value from jsonb_array_elements(v_payments) loop
    v_method := upper(coalesce(v_pay->>'method', ''));
    if v_method = 'BANK_TRANSFER' then v_method := 'ONLINE'; end if;
    v_amt := round(coalesce(nullif(v_pay->>'amount', '')::numeric, 0), 2);
    if v_amt < 0 then raise exception 'Payment amounts cannot be negative'; end if;
    if v_method = 'CASH' then v_cash := v_cash + v_amt;
    elsif v_method = 'CARD' then v_card := v_card + v_amt;
    elsif v_method = 'ONLINE' then v_online := v_online + v_amt;
    elsif v_method = 'CREDIT' then v_has_credit := true;
    else raise exception 'Unknown payment method: %', v_method;
    end if;
    if coalesce(v_pay->>'reference', '') <> '' then
      v_refs := v_refs || jsonb_build_object(v_method, trim(both ' ' from coalesce(v_refs->>v_method, '') || ' ' || (v_pay->>'reference')));
    end if;
  end loop;

  if v_card + v_online > v_total then
    raise exception 'Card / online amount is more than the bill total. Only cash can give change.';
  end if;
  if v_has_credit then
    v_credit := greatest(0, v_total - v_card - v_online - v_cash);
    v_change := greatest(0, v_cash - (v_total - v_card - v_online));
  else
    if v_cash + v_card + v_online < v_total then
      raise exception 'Payment is short by %', v_total - v_cash - v_card - v_online;
    end if;
    v_change := v_cash + v_card + v_online - v_total;
  end if;

  -- 5. Customer, credit (khata) and its limit
  if v_customer_id <> 'WALK-IN' then
    select * into v_customer from customers where customer_id = v_customer_id for update;
    if not found then raise exception 'Customer not found'; end if;
    if v_customer.status <> 'ACTIVE' then raise exception 'Customer "%" is inactive', v_customer.name; end if;
    v_customer_name := v_customer.name;
    v_bal_before := v_customer.outstanding_balance;
    v_bal_after := v_bal_before;
  end if;
  if v_credit > 0 then
    if v_customer_id = 'WALK-IN' then
      raise exception 'Walk-in customers cannot buy on credit (khata). Select a registered customer.';
    end if;
    if v_customer.credit_limit > 0 and v_customer.outstanding_balance + v_credit > v_customer.credit_limit then
      v_need := v_need || format('Credit limit exceeded: khata would be %s, limit is %s',
                                 v_customer.outstanding_balance + v_credit, v_customer.credit_limit);
    end if;
  end if;

  -- 6. Manager approval when over a limit
  if array_length(v_need, 1) > 0 then
    if v_profile.role = 'ADMIN' then
      v_approved_by := v_name;
    elsif coalesce(p->>'approvalToken', '') = '' then
      raise exception 'APPROVAL_REQUIRED: %', array_to_string(v_need, '; ');
    else
      v_approved_by := _consume_approval(p->>'approvalToken', 'SALE: ' || array_to_string(v_need, '; '));
    end if;
  end if;

  -- 7. Invoice number per store day: INV-YYYYMMDD-0001
  perform pg_advisory_xact_lock(hashtext('sales_invoice_seq'));
  v_prefix := 'INV-' || to_char(v_now at time zone store_tz(), 'YYYYMMDD') || '-';
  select coalesce(max(nullif(regexp_replace(substr(invoice_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1
    into v_seq from sales where invoice_number like v_prefix || '%';
  v_invoice := v_prefix || lpad(v_seq::text, 4, '0');

  if v_cash - v_change > 0 or (v_cash > 0 and v_total = 0) then v_tenders := v_tenders || 'CASH'::text; end if;
  if v_card > 0 then v_tenders := v_tenders || 'CARD'::text; end if;
  if v_online > 0 then v_tenders := v_tenders || 'ONLINE'::text; end if;
  if v_credit > 0 then v_tenders := v_tenders || 'CREDIT'::text; end if;

  insert into sales (invoice_number, date, cashier_id, cashier_name, customer_id, customer_name,
                     subtotal, discount, tax, total, amount_paid, change, payment_method, payment_status,
                     status, notes, created_at, shift_id, credit_amount, line_discount_total, approved_by)
  values (v_invoice, v_now, v_uid::text, v_name, v_customer_id, v_customer_name,
          v_subtotal, v_bill_disc, v_tax, v_total, v_total - v_credit, v_change,
          case when coalesce(array_length(v_tenders, 1), 0) = 0 then 'CASH'
               when array_length(v_tenders, 1) = 1 then v_tenders[1] else 'SPLIT' end,
          case when v_credit = 0 then 'PAID' when v_credit < v_total then 'PARTIAL' else 'UNPAID' end,
          'COMPLETED', left(coalesce(p->>'notes', ''), 500), v_now, v_shift_id, v_credit, v_line_disc_total, v_approved_by)
  returning * into v_sale;

  -- 8. Items + stock
  for v_line in select value from jsonb_array_elements(v_lines) loop
    v_qty := (v_line->>'qty')::numeric;
    insert into sale_items (sale_id, product_id, product_name, quantity, unit, unit_price, unit_cost, discount, line_total, created_at)
    values (v_sale.sale_id, v_line->>'productId', v_line->>'name', v_qty, v_line->>'unit',
            (v_line->>'price')::numeric, (v_line->>'cost')::numeric, (v_line->>'discount')::numeric,
            (v_line->>'lineTotal')::numeric, v_now)
    returning * into v_si;
    v_items_out := v_items_out || to_jsonb(v_si);

    update products set current_stock = current_stock - v_qty, updated_at = v_now where product_id = v_line->>'productId';
    insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                 reference_id, reason, created_by, created_by_id, created_at)
    values (v_line->>'productId', 'SALE', -v_qty, (v_line->>'stock')::numeric, (v_line->>'stock')::numeric - v_qty,
            'INVOICE', v_invoice, 'POS Sale ' || v_invoice, v_name, v_uid, v_now);
  end loop;

  -- 9. Payment rows
  if v_cash > 0 then
    insert into sale_payments (sale_id, method, amount, tendered, reference)
    values (v_sale.sale_id, 'CASH', v_cash - v_change, v_cash, coalesce(v_refs->>'CASH', ''));
  end if;
  if v_card > 0 then
    insert into sale_payments (sale_id, method, amount, tendered, reference)
    values (v_sale.sale_id, 'CARD', v_card, v_card, coalesce(v_refs->>'CARD', ''));
  end if;
  if v_online > 0 then
    insert into sale_payments (sale_id, method, amount, tendered, reference)
    values (v_sale.sale_id, 'ONLINE', v_online, v_online, coalesce(v_refs->>'ONLINE', ''));
  end if;
  if v_credit > 0 then
    insert into sale_payments (sale_id, method, amount, tendered, reference)
    values (v_sale.sale_id, 'CREDIT', v_credit, 0, '');
    v_bal_after := (_customer_ledger(v_customer_id, 'SALE_CREDIT', v_credit, 0, v_invoice, 'CREDIT',
                                     'Khata sale ' || v_invoice, v_shift_id)).balance_after;
  end if;

  perform audit('CREATE_SALE', 'SALE', v_sale.sale_id,
    jsonb_build_object('invoiceNumber', v_invoice, 'total', v_total, 'itemCount', jsonb_array_length(v_lines),
                       'discount', v_line_disc_total + v_bill_disc, 'credit', v_credit,
                       'approvedBy', nullif(v_approved_by, '')));

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', v_items_out,
    'payments', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at, x.method), '[]'::jsonb)
                   from sale_payments x where x.sale_id = v_sale.sale_id),
    'customerBalanceBefore', v_bal_before,
    'customerBalanceAfter', v_bal_after);
end;
$$;

-- Full sale details (sale, items, tenders, returns, khata balance)
create or replace function public.get_sale_details(p_sale_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_sale sales%rowtype;
  v_after numeric;
  v_before numeric;
begin
  select * into v_sale from sales where sale_id = p_sale_id;
  if not found then raise exception 'Sale not found'; end if;
  if not is_admin() and v_sale.cashier_id is distinct from auth.uid()::text then
    raise exception 'You can only open your own bills';
  end if;
  select balance_after, balance_after - debit + credit into v_after, v_before
    from customer_ledger where customer_id = v_sale.customer_id and reference = v_sale.invoice_number and type = 'SALE_CREDIT'
   order by created_at limit 1;
  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at, i.sale_item_id), '[]'::jsonb) from sale_items i where i.sale_id = p_sale_id),
    'payments', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at, x.method), '[]'::jsonb) from sale_payments x where x.sale_id = p_sale_id),
    'returns', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at), '[]'::jsonb) from sale_returns r where r.sale_id = p_sale_id),
    'customerBalanceBefore', v_before,
    'customerBalanceAfter', v_after);
end $$;

-- ---------------------------------------------------------------------
-- RETURNS: partial (per line) and full cancel
-- ---------------------------------------------------------------------

create or replace function public.return_sale_items(p_sale_id text, p_items jsonb, p_reason text,
                                                    p_refund_method text default 'CASH', p_approval_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid          uuid := auth.uid();
  v_name         text := current_staff_name();
  v_sale         sales%rowtype;
  v_si           sale_items%rowtype;
  v_item         jsonb;
  v_qty          numeric;
  v_factor       numeric;
  v_value        numeric := 0;
  v_line_value   numeric;
  v_new          numeric;
  v_ret_items    jsonb := '[]'::jsonb;
  v_method       text := upper(coalesce(nullif(p_refund_method, ''), 'CASH'));
  v_credit_left  numeric;
  v_credit_rev   numeric := 0;
  v_refund       numeric := 0;
  v_shift_id     text := _my_open_shift();
  v_approved_by  text := '';
  v_all_back     boolean;
  v_ret          sale_returns%rowtype;
  v_bal          numeric;
begin
  if not is_staff() then raise exception 'Please sign in first'; end if;
  select * into v_sale from sales where sale_id = p_sale_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if v_sale.status <> 'COMPLETED' then raise exception 'Only completed sales can be returned'; end if;
  if v_method = 'BANK_TRANSFER' then v_method := 'ONLINE'; end if;
  if v_method not in ('CASH', 'CARD', 'ONLINE', 'CREDIT') then raise exception 'Unknown refund method: %', v_method; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for the return'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one item to return';
  end if;

  if is_admin() then
    v_approved_by := v_name;
  else
    if v_sale.cashier_id is distinct from v_uid::text and coalesce(p_approval_token, '') = '' then
      raise exception 'APPROVAL_REQUIRED: This bill was made by another cashier';
    end if;
    if not _perm_bool('canReturn') or v_sale.cashier_id is distinct from v_uid::text then
      if coalesce(p_approval_token, '') = '' then
        raise exception 'APPROVAL_REQUIRED: Returns need manager approval';
      end if;
      v_approved_by := _consume_approval(p_approval_token, 'RETURN ' || v_sale.invoice_number);
    end if;
  end if;
  if v_method = 'CREDIT' and coalesce(v_sale.customer_id, 'WALK-IN') = 'WALK-IN' then
    raise exception 'Walk-in sales cannot be refunded to khata';
  end if;

  v_factor := case when v_sale.subtotal > 0 then v_sale.total / v_sale.subtotal else 0 end;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'saleItemId' loop
    v_qty := round(coalesce(nullif(v_item->>'qty', '')::numeric, nullif(v_item->>'quantity', '')::numeric, 0), 3);
    continue when v_qty = 0;
    select * into v_si from sale_items where sale_item_id = v_item->>'saleItemId' and sale_id = p_sale_id for update;
    if not found then raise exception 'Item is not on this bill'; end if;
    if v_qty < 0 then raise exception 'Return quantity cannot be negative'; end if;
    if v_qty > v_si.quantity - v_si.returned_qty then
      raise exception 'Only % of "%" can still be returned', v_si.quantity - v_si.returned_qty, v_si.product_name;
    end if;
    if not _is_weighted_unit(v_si.unit) and v_qty <> trunc(v_qty) then
      raise exception 'Return quantity of "%" must be a whole number', v_si.product_name;
    end if;
    v_line_value := round(v_si.line_total / nullif(v_si.quantity, 0) * v_qty * v_factor, 2);
    v_value := v_value + coalesce(v_line_value, 0);

    update sale_items set returned_qty = returned_qty + v_qty where sale_item_id = v_si.sale_item_id;
    update products set current_stock = current_stock + v_qty, updated_at = now()
     where product_id = v_si.product_id returning current_stock into v_new;
    if v_new is not null then
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                   reference_id, reason, created_by, created_by_id)
      values (v_si.product_id, 'SALE_RETURN', v_qty, v_new - v_qty, v_new, 'SALE_RETURN', v_sale.invoice_number,
              'Return: ' || trim(p_reason), v_name, v_uid);
    end if;
    v_ret_items := v_ret_items || jsonb_build_object('saleItemId', v_si.sale_item_id, 'productId', v_si.product_id,
                                                     'productName', v_si.product_name, 'qty', v_qty, 'value', v_line_value);
  end loop;

  if jsonb_array_length(v_ret_items) = 0 then raise exception 'Choose at least one item to return'; end if;

  select bool_and(returned_qty >= quantity) into v_all_back from sale_items where sale_id = p_sale_id;
  if v_all_back then
    v_value := v_sale.total - v_sale.returned_total;   -- last return settles rounding exactly
  else
    v_value := least(v_value, v_sale.total - v_sale.returned_total);
  end if;

  v_credit_left := greatest(0, v_sale.credit_amount - v_sale.credit_returned);
  if v_method = 'CREDIT' then
    v_credit_rev := v_value;
  else
    v_credit_rev := least(v_credit_left, v_value);
    v_refund := v_value - v_credit_rev;
  end if;
  if v_refund > 0 and v_method = 'CASH' and v_shift_id is null and not is_admin() then
    raise exception 'Open your shift before giving a cash refund';
  end if;

  if v_credit_rev > 0 then
    v_bal := (_customer_ledger(v_sale.customer_id, 'RETURN', 0, v_credit_rev, v_sale.invoice_number, 'CREDIT',
                               'Return: ' || trim(p_reason), v_shift_id)).balance_after;
  end if;

  insert into sale_returns (sale_id, type, items, total, credit_amount, refund_amount, refund_method, reason, shift_id,
                            approved_by, created_by, created_by_id)
  values (p_sale_id, 'PARTIAL', v_ret_items, v_value, v_credit_rev, v_refund,
          case when v_refund > 0 then v_method else 'CREDIT' end, trim(p_reason), v_shift_id, v_approved_by, v_name, v_uid)
  returning * into v_ret;

  update sales set returned_total = returned_total + v_value,
                   credit_returned = credit_returned + least(v_credit_rev, v_credit_left)
   where sale_id = p_sale_id;

  perform audit('RETURN_SALE_ITEMS', 'SALE', p_sale_id,
    jsonb_build_object('invoiceNumber', v_sale.invoice_number, 'value', v_value, 'refund', v_refund,
                       'refundMethod', v_method, 'khataReduced', v_credit_rev, 'items', v_ret_items,
                       'reason', p_reason, 'approvedBy', nullif(v_approved_by, '')));

  return to_jsonb(v_ret) || jsonb_build_object('customerBalanceAfter', v_bal);
end $$;

-- Cancel the whole sale: restock what is left and reverse only the unpaid (khata) part
create or replace function public.cancel_sale(p_sale_id text, p_reason text default '', p_refund_method text default 'CASH')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name         text := current_staff_name();
  v_sale         sales%rowtype;
  v_si           sale_items%rowtype;
  v_new          numeric;
  v_left         numeric;
  v_value        numeric;
  v_credit_left  numeric;
  v_credit_rev   numeric;
  v_refund       numeric;
  v_method       text := upper(coalesce(nullif(p_refund_method, ''), 'CASH'));
begin
  perform _require_admin();
  select * into v_sale from sales where sale_id = p_sale_id for update;
  if not found then raise exception 'Sale record not found'; end if;
  if v_sale.status = 'CANCELLED' then raise exception 'Sale is already cancelled'; end if;
  if v_method not in ('CASH', 'CARD', 'ONLINE') then v_method := 'CASH'; end if;

  for v_si in select * from sale_items where sale_id = p_sale_id order by product_id loop
    v_left := v_si.quantity - v_si.returned_qty;
    continue when v_left <= 0;
    update sale_items set returned_qty = quantity where sale_item_id = v_si.sale_item_id;
    update products set current_stock = current_stock + v_left, updated_at = now()
     where product_id = v_si.product_id returning current_stock into v_new;
    if v_new is not null then
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                   reference_id, reason, created_by, created_by_id)
      values (v_si.product_id, 'SALE_RETURN', v_left, v_new - v_left, v_new, 'SALE_CANCEL', v_sale.invoice_number,
              'Cancelled sale: ' || coalesce(nullif(p_reason, ''), 'Customer Return'), v_name, auth.uid());
    end if;
  end loop;

  v_value := v_sale.total - v_sale.returned_total;
  v_credit_left := greatest(0, v_sale.credit_amount - v_sale.credit_returned);
  v_credit_rev := least(v_credit_left, v_value);
  v_refund := v_value - v_credit_rev;

  if v_credit_rev > 0 then
    perform _customer_ledger(v_sale.customer_id, 'RETURN', 0, v_credit_rev, v_sale.invoice_number, 'CREDIT',
                             'Sale cancelled: ' || coalesce(nullif(p_reason, ''), 'No reason given'), _my_open_shift());
  end if;
  if v_value > 0 then
    insert into sale_returns (sale_id, type, items, total, credit_amount, refund_amount, refund_method, reason,
                              shift_id, approved_by, created_by, created_by_id)
    values (p_sale_id, 'CANCEL', '[]'::jsonb, v_value, v_credit_rev, v_refund,
            case when v_refund > 0 then v_method else 'CREDIT' end, coalesce(p_reason, ''),
            _my_open_shift(), v_name, v_name, auth.uid());
  end if;

  update sales
     set status = 'CANCELLED', returned_total = total, credit_returned = credit_returned + v_credit_rev,
         notes = case when coalesce(notes, '') = '' then '' else notes || ' | ' end
                 || 'Cancelled: ' || coalesce(nullif(p_reason, ''), 'No reason given')
   where sale_id = p_sale_id;

  perform audit('CANCEL_SALE', 'SALE', p_sale_id,
    jsonb_build_object('invoiceNumber', v_sale.invoice_number, 'reason', p_reason, 'refund', v_refund, 'khataReduced', v_credit_rev));

  return 'Sale ' || v_sale.invoice_number || ' cancelled and inventory restored';
end;
$$;

-- ---------------------------------------------------------------------
-- PRODUCTS + STOCK
-- ---------------------------------------------------------------------

create or replace function public.save_product(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id     text := nullif(p->>'productId', '');
  v_row    products%rowtype;
  v_sku    text := nullif(trim(coalesce(p->>'sku', '')), '');
  v_stock  numeric := round(coalesce(nullif(p->>'currentStock', '')::numeric, 0), 3);
  v_try    int := 0;
begin
  perform _require_admin();
  if trim(coalesce(p->>'name', '')) = '' then raise exception 'Product name is required'; end if;
  if coalesce(nullif(p->>'sellingPrice', '')::numeric, 0) < 0 or coalesce(nullif(p->>'costPrice', '')::numeric, 0) < 0 then
    raise exception 'Prices cannot be negative';
  end if;
  if v_id like 'PROD-TEMP-%' then v_id := null; end if;

  begin
    if v_id is not null and exists (select 1 from products where product_id = v_id) then
      update products
         set name = trim(p->>'name'),
             sku = coalesce(v_sku, sku),
             barcode = trim(coalesce(p->>'barcode', '')),
             category_id = nullif(p->>'categoryId', ''),
             unit = coalesce(nullif(p->>'unit', ''), 'piece'),
             cost_price = coalesce(nullif(p->>'costPrice', '')::numeric, 0),
             selling_price = coalesce(nullif(p->>'sellingPrice', '')::numeric, 0),
             minimum_stock = coalesce(nullif(p->>'minimumStock', '')::numeric, 5),
             expiry_date = nullif(p->>'expiryDate', '')::date,
             status = coalesce(nullif(p->>'status', ''), status),
             updated_at = now()
       where product_id = v_id
      returning * into v_row;
      perform audit('UPDATE_PRODUCT', 'PRODUCT', v_id, jsonb_build_object('name', v_row.name, 'sellingPrice', v_row.selling_price));
    else
      if v_stock < 0 then raise exception 'Opening stock cannot be negative'; end if;
      while v_sku is null or exists (select 1 from products where sku = v_sku) loop
        exit when v_sku is not null and v_try = 0;   -- a typed SKU that exists -> unique error below
        v_sku := 'SKU-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
        v_try := v_try + 1;
      end loop;
      insert into products (name, sku, barcode, category_id, unit, cost_price, selling_price, current_stock,
                            minimum_stock, expiry_date, status)
      values (trim(p->>'name'), v_sku, trim(coalesce(p->>'barcode', '')), nullif(p->>'categoryId', ''),
              coalesce(nullif(p->>'unit', ''), 'piece'), coalesce(nullif(p->>'costPrice', '')::numeric, 0),
              coalesce(nullif(p->>'sellingPrice', '')::numeric, 0), v_stock,
              coalesce(nullif(p->>'minimumStock', '')::numeric, 5), nullif(p->>'expiryDate', '')::date, 'ACTIVE')
      returning * into v_row;
      if v_stock > 0 then
        insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                     reference_id, reason, created_by, created_by_id)
        values (v_row.product_id, 'INITIAL_STOCK', v_stock, 0, v_stock, 'MANUAL', v_row.product_id,
                'Initial inventory creation', current_staff_name(), auth.uid());
      end if;
      perform audit('CREATE_PRODUCT', 'PRODUCT', v_row.product_id, jsonb_build_object('name', v_row.name, 'openingStock', v_stock));
    end if;
  exception when unique_violation then
    if sqlerrm like '%products_barcode_key%' then
      raise exception 'This barcode is already used by another product';
    elsif sqlerrm like '%products_sku_key%' then
      raise exception 'This SKU is already used by another product';
    end if;
    raise;
  end;
  return to_jsonb(v_row);
end $$;

create or replace function public.delete_product(p_product_id text, p_permanent boolean default false)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  if p_permanent then
    if exists (select 1 from sale_items where product_id = p_product_id)
       or exists (select 1 from purchase_items where product_id = p_product_id) then
      raise exception 'This product has sales or purchase history and cannot be deleted. Deactivate it instead.';
    end if;
    delete from stock_movements where product_id = p_product_id;
    delete from products where product_id = p_product_id;
    perform audit('DELETE_PRODUCT', 'PRODUCT', p_product_id, '{}'::jsonb);
    return 'Product permanently deleted';
  end if;
  update products set status = 'INACTIVE', updated_at = now() where product_id = p_product_id;
  if not found then raise exception 'Product not found'; end if;
  perform audit('DEACTIVATE_PRODUCT', 'PRODUCT', p_product_id, '{}'::jsonb);
  return 'Product marked as inactive';
end $$;

create or replace function public.adjust_stock(p_product_id text, p_adjustment_type text, p_quantity numeric,
                                               p_reason text default '')
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_qty   numeric := abs(coalesce(p_quantity, 0));
  v_prev  numeric;
  v_new   numeric;
begin
  perform _require_admin();
  if v_qty <= 0 and p_adjustment_type <> 'SET' then raise exception 'Adjustment quantity must be greater than 0'; end if;

  select current_stock into v_prev from products where product_id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;

  if p_adjustment_type = 'ADD' then
    v_new := v_prev + v_qty;
  elsif p_adjustment_type = 'SUBTRACT' then
    if v_prev < v_qty then raise exception 'Cannot subtract more than current stock (%)', v_prev; end if;
    v_new := v_prev - v_qty;
  elsif p_adjustment_type = 'SET' then
    v_new := v_qty;
  else
    raise exception 'Unknown adjustment type: %', p_adjustment_type;
  end if;

  update products set current_stock = v_new, updated_at = now() where product_id = p_product_id;
  insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock,
                               reference_type, reference_id, reason, created_by, created_by_id)
  values (p_product_id, 'ADJUSTMENT', v_new - v_prev, v_prev, v_new, 'MANUAL_ADJUSTMENT',
          'ADJ-' || (extract(epoch from now()) * 1000)::bigint,
          coalesce(nullif(p_reason, ''), 'Manual stock adjustment'), current_staff_name(), auth.uid());
  perform audit('ADJUST_STOCK', 'PRODUCT', p_product_id,
    jsonb_build_object('prevStock', v_prev, 'newStock', v_new, 'reason', p_reason));
  return v_new;
end;
$$;

-- Stock counts: start (snapshot) -> enter counted qty -> apply variance
create or replace function public.start_stock_count(p_category_id text default null, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count stock_counts%rowtype;
  v_prefix text := 'SC-' || to_char(now() at time zone store_tz(), 'YYYYMMDD') || '-';
  v_seq int;
begin
  perform _require_admin();
  perform pg_advisory_xact_lock(hashtext('stock_count_seq'));
  select coalesce(max(nullif(regexp_replace(substr(count_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1
    into v_seq from stock_counts where count_number like v_prefix || '%';
  insert into stock_counts (count_number, category_id, notes, created_by, created_by_id)
  values (v_prefix || lpad(v_seq::text, 2, '0'), nullif(p_category_id, ''), coalesce(p_notes, ''), current_staff_name(), auth.uid())
  returning * into v_count;
  insert into stock_count_items (count_id, product_id, product_name, sku, unit, system_qty, unit_cost)
  select v_count.count_id, product_id, name, coalesce(sku, ''), coalesce(unit, 'piece'), current_stock, cost_price
    from products
   where status <> 'INACTIVE' and (nullif(p_category_id, '') is null or category_id = p_category_id);
  perform audit('START_STOCK_COUNT', 'STOCK_COUNT', v_count.count_id, jsonb_build_object('countNumber', v_count.count_number));
  return to_jsonb(v_count) || jsonb_build_object('item_count', (select count(*) from stock_count_items where count_id = v_count.count_id));
end $$;

create or replace function public.apply_stock_count(p_count_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count  stock_counts%rowtype;
  v_it     stock_count_items%rowtype;
  v_prev   numeric;
  v_delta  numeric;
  v_lines  int := 0;
  v_value  numeric := 0;
begin
  perform _require_admin();
  select * into v_count from stock_counts where count_id = p_count_id for update;
  if not found then raise exception 'Stock count not found'; end if;
  if v_count.status <> 'OPEN' then raise exception 'This stock count is already %', lower(v_count.status); end if;

  for v_it in select * from stock_count_items where count_id = p_count_id and counted_qty is not null order by product_id loop
    v_delta := v_it.counted_qty - v_it.system_qty;
    continue when v_delta = 0;
    -- sales made during the count are kept: apply only the difference found
    select current_stock into v_prev from products where product_id = v_it.product_id for update;
    continue when not found;
    update products set current_stock = v_prev + v_delta, updated_at = now() where product_id = v_it.product_id;
    insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                 reference_id, reason, created_by, created_by_id)
    values (v_it.product_id, 'ADJUSTMENT', v_delta, v_prev, v_prev + v_delta, 'STOCK_COUNT', v_count.count_number,
            'Stock count variance', current_staff_name(), auth.uid());
    v_lines := v_lines + 1;
    v_value := v_value + v_delta * v_it.unit_cost;
  end loop;

  update stock_counts set status = 'APPLIED', applied_at = now(), applied_by = current_staff_name() where count_id = p_count_id;
  perform audit('APPLY_STOCK_COUNT', 'STOCK_COUNT', p_count_id,
                jsonb_build_object('countNumber', v_count.count_number, 'linesAdjusted', v_lines, 'varianceValue', v_value));
  return jsonb_build_object('linesAdjusted', v_lines, 'varianceValue', v_value);
end $$;

create or replace function public.cancel_stock_count(p_count_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update stock_counts set status = 'CANCELLED' where count_id = p_count_id and status = 'OPEN';
  if not found then raise exception 'Only an open stock count can be cancelled'; end if;
  perform audit('CANCEL_STOCK_COUNT', 'STOCK_COUNT', p_count_id, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- PURCHASES: DRAFT -> ORDERED -> PARTIALLY_RECEIVED -> RECEIVED (or CANCELLED)
-- ---------------------------------------------------------------------

create or replace function public._purchase_recalc(p_purchase_id text)
returns void language sql security definer set search_path = public as $$
  update purchases p
     set subtotal = x.ordered, total = x.ordered + p.tax, received_total = x.received, returned_total = x.returned,
         outstanding_balance = greatest(0, (case when p.status in ('PARTIALLY_RECEIVED', 'RECEIVED') then x.received else x.ordered + p.tax end)
                                           - x.returned - p.amount_paid),
         updated_at = now()
    from (select coalesce(sum(quantity * unit_cost), 0) ordered,
                 coalesce(sum(received_qty * unit_cost), 0) received,
                 coalesce(sum(returned_qty * unit_cost), 0) returned
            from purchase_items where purchase_id = p_purchase_id) x
   where p.purchase_id = p_purchase_id;
$$;

create or replace function public._purchase_items_write(p_purchase_id text, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_prod products%rowtype;
  v_qty  numeric;
  v_cost numeric;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;
  delete from purchase_items where purchase_id = p_purchase_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_prod from products where product_id = v_item->>'productId';
    if not found then raise exception 'Product not found: %', coalesce(v_item->>'productName', v_item->>'productId'); end if;
    v_qty := round(coalesce(nullif(v_item->>'quantity', '')::numeric, 0), 3);
    v_cost := round(coalesce(nullif(v_item->>'unitCost', '')::numeric, 0), 2);
    if v_qty <= 0 then raise exception 'Quantity for "%" must be greater than 0', v_prod.name; end if;
    if v_cost < 0 then raise exception 'Cost for "%" cannot be negative', v_prod.name; end if;
    insert into purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    values (p_purchase_id, v_prod.product_id, v_prod.name, v_qty, v_cost, round(v_qty * v_cost, 2));
  end loop;
end $$;

create or replace function public.create_purchase(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_supp      suppliers%rowtype;
  v_paid      numeric := round(coalesce(nullif(p->>'amountPaid', '')::numeric, 0), 2);
  v_status    text := upper(coalesce(nullif(p->>'status', ''), 'ORDERED'));
  v_prefix    text;
  v_seq       int;
  v_purchase  purchases%rowtype;
begin
  perform _require_admin();
  if v_status not in ('DRAFT', 'ORDERED') then v_status := 'ORDERED'; end if;
  select * into v_supp from suppliers where supplier_id = p->>'supplierId';
  if not found then raise exception 'Choose a supplier'; end if;
  if v_paid < 0 then raise exception 'Amount paid cannot be negative'; end if;

  perform pg_advisory_xact_lock(hashtext('purchase_number_seq'));
  v_prefix := 'PO-' || to_char(now() at time zone store_tz(), 'YYYYMMDD') || '-';
  select coalesce(max(nullif(regexp_replace(substr(purchase_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1
    into v_seq from purchases where purchase_number like v_prefix || '%';

  insert into purchases (purchase_number, supplier_id, supplier_name, status, notes, created_by)
  values (v_prefix || lpad(v_seq::text, 3, '0'), v_supp.supplier_id, v_supp.name, v_status,
          coalesce(p->>'notes', ''), current_staff_name())
  returning * into v_purchase;
  perform _purchase_items_write(v_purchase.purchase_id, p->'items');

  if v_paid > 0 then
    perform _supplier_ledger(v_supp.supplier_id, 'PAYMENT', 0, v_paid, v_purchase.purchase_id, v_purchase.purchase_number,
                             coalesce(nullif(p->>'paymentMethod', ''), 'CASH'), 'Paid with order');
    update purchases set amount_paid = v_paid where purchase_id = v_purchase.purchase_id;
  end if;
  perform _purchase_recalc(v_purchase.purchase_id);
  select * into v_purchase from purchases where purchase_id = v_purchase.purchase_id;
  if v_paid > v_purchase.total then raise exception 'Amount paid is more than the order total'; end if;

  perform audit('CREATE_PURCHASE', 'PURCHASE', v_purchase.purchase_id,
    jsonb_build_object('purchaseNumber', v_purchase.purchase_number, 'total', v_purchase.total, 'status', v_status));
  return to_jsonb(v_purchase);
end;
$$;

-- Edit a purchase order that has not received anything yet
create or replace function public.update_purchase(p_purchase_id text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pur     purchases%rowtype;
  v_status  text := upper(coalesce(nullif(p->>'status', ''), ''));
begin
  perform _require_admin();
  select * into v_pur from purchases where purchase_id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_pur.status not in ('DRAFT', 'ORDERED') or exists (select 1 from purchase_items where purchase_id = p_purchase_id and received_qty > 0) then
    raise exception 'Only orders that have not been received can be edited';
  end if;
  if coalesce(p->>'supplierId', v_pur.supplier_id) <> v_pur.supplier_id then
    if v_pur.amount_paid > 0 then raise exception 'Supplier cannot be changed after a payment was made on this order'; end if;
    update purchases set supplier_id = s.supplier_id, supplier_name = s.name
      from suppliers s where s.supplier_id = p->>'supplierId' and purchases.purchase_id = p_purchase_id;
    if not found then raise exception 'Supplier not found'; end if;
  end if;
  if p ? 'items' then perform _purchase_items_write(p_purchase_id, p->'items'); end if;
  update purchases set notes = coalesce(p->>'notes', notes),
                       status = case when v_status in ('DRAFT', 'ORDERED') then v_status else status end
   where purchase_id = p_purchase_id;
  perform _purchase_recalc(p_purchase_id);
  select * into v_pur from purchases where purchase_id = p_purchase_id;
  if v_pur.amount_paid > v_pur.total then raise exception 'Order total cannot be less than the amount already paid'; end if;
  perform audit('UPDATE_PURCHASE', 'PURCHASE', p_purchase_id, jsonb_build_object('total', v_pur.total, 'status', v_pur.status));
  return to_jsonb(v_pur);
end $$;

create or replace function public.cancel_purchase(p_purchase_id text, p_reason text default '')
returns text language plpgsql security definer set search_path = public as $$
declare v_pur purchases%rowtype;
begin
  perform _require_admin();
  select * into v_pur from purchases where purchase_id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_pur.status not in ('DRAFT', 'ORDERED') or exists (select 1 from purchase_items where purchase_id = p_purchase_id and received_qty > 0) then
    raise exception 'Only orders that have not been received can be cancelled';
  end if;
  update purchases set status = 'CANCELLED', cancelled_reason = coalesce(p_reason, ''), outstanding_balance = 0, updated_at = now()
   where purchase_id = p_purchase_id;
  perform audit('CANCEL_PURCHASE', 'PURCHASE', p_purchase_id, jsonb_build_object('reason', p_reason));
  return case when v_pur.amount_paid > 0
              then 'Order cancelled. The ' || v_pur.amount_paid || ' already paid stays as an advance with the supplier.'
              else 'Order cancelled' end;
end $$;

-- Receive stock (partial deliveries). p_items = [{purchaseItemId, qty}], null = everything still due.
create or replace function public.receive_purchase(p_purchase_id text, p_items jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pur    purchases%rowtype;
  v_pi     purchase_items%rowtype;
  v_qty    numeric;
  v_prev   numeric;
  v_cost   numeric;
  v_value  numeric := 0;
  v_lines  int := 0;
  v_status text;
begin
  perform _require_admin();
  select * into v_pur from purchases where purchase_id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_pur.status not in ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED') then
    raise exception 'This order is % and cannot receive stock', lower(v_pur.status);
  end if;

  for v_pi in select * from purchase_items where purchase_id = p_purchase_id order by product_id, purchase_item_id for update loop
    if p_items is null or jsonb_typeof(p_items) <> 'array' then
      v_qty := v_pi.quantity - v_pi.received_qty;
    else
      select round(coalesce(sum(coalesce(nullif(x->>'qty', '')::numeric, nullif(x->>'quantity', '')::numeric, 0)), 0), 3)
        into v_qty from jsonb_array_elements(p_items) x where x->>'purchaseItemId' = v_pi.purchase_item_id;
    end if;
    continue when coalesce(v_qty, 0) = 0;
    if v_qty < 0 then raise exception 'Received quantity cannot be negative'; end if;
    if v_qty > v_pi.quantity - v_pi.received_qty then
      raise exception 'Only % of "%" is still due on this order', v_pi.quantity - v_pi.received_qty, v_pi.product_name;
    end if;

    select current_stock, cost_price into v_prev, v_cost from products where product_id = v_pi.product_id for update;
    if found then
      -- weighted average cost instead of overwriting
      if v_pi.unit_cost > 0 then
        v_cost := round((greatest(v_prev, 0) * v_cost + v_qty * v_pi.unit_cost) / nullif(greatest(v_prev, 0) + v_qty, 0), 2);
      end if;
      update products set current_stock = v_prev + v_qty, cost_price = coalesce(v_cost, cost_price), updated_at = now()
       where product_id = v_pi.product_id;
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                   reference_id, reason, created_by, created_by_id)
      values (v_pi.product_id, 'PURCHASE', v_qty, v_prev, v_prev + v_qty, 'PURCHASE_ORDER', v_pur.purchase_number,
              'Stock received from ' || coalesce(v_pur.supplier_name, 'supplier'), current_staff_name(), auth.uid());
    end if;
    update purchase_items set received_qty = received_qty + v_qty where purchase_item_id = v_pi.purchase_item_id;
    v_value := v_value + round(v_qty * v_pi.unit_cost, 2);
    v_lines := v_lines + 1;
  end loop;

  if v_lines = 0 then raise exception 'Enter a received quantity for at least one item'; end if;

  select case when bool_and(received_qty >= quantity) then 'RECEIVED' else 'PARTIALLY_RECEIVED' end into v_status
    from purchase_items where purchase_id = p_purchase_id;
  update purchases set status = v_status, received_at = now() where purchase_id = p_purchase_id;
  perform _purchase_recalc(p_purchase_id);
  if v_value > 0 and v_pur.supplier_id is not null then
    perform _supplier_ledger(v_pur.supplier_id, 'PURCHASE', v_value, 0, p_purchase_id, v_pur.purchase_number, '',
                             'Goods received');
  end if;
  perform audit('RECEIVE_PURCHASE', 'PURCHASE', p_purchase_id,
    jsonb_build_object('purchaseNumber', v_pur.purchase_number, 'value', v_value, 'lines', v_lines, 'status', v_status));
  return jsonb_build_object('status', v_status, 'value', v_value, 'lines', v_lines);
end $$;

-- Old one-click "confirm" = receive everything still due
create or replace function public.confirm_purchase(p_purchase_id text)
returns text language plpgsql security definer set search_path = public as $$
begin
  perform receive_purchase(p_purchase_id, null);
  return 'Purchase received. Inventory updated.';
end $$;

-- Return received goods to the supplier: stock out + supplier ledger credit
create or replace function public.return_purchase(p_purchase_id text, p_items jsonb, p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pur    purchases%rowtype;
  v_pi     purchase_items%rowtype;
  v_item   jsonb;
  v_qty    numeric;
  v_prev   numeric;
  v_value  numeric := 0;
  v_allow  boolean := setting('allowNegativeStock', 'false') = 'true';
begin
  perform _require_admin();
  select * into v_pur from purchases where purchase_id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Choose items to return'; end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'purchaseItemId' loop
    v_qty := round(coalesce(nullif(v_item->>'qty', '')::numeric, nullif(v_item->>'quantity', '')::numeric, 0), 3);
    continue when v_qty = 0;
    select * into v_pi from purchase_items where purchase_item_id = v_item->>'purchaseItemId' and purchase_id = p_purchase_id for update;
    if not found then raise exception 'Item is not on this order'; end if;
    if v_qty < 0 or v_qty > v_pi.received_qty - v_pi.returned_qty then
      raise exception 'Only % of "%" can be returned', v_pi.received_qty - v_pi.returned_qty, v_pi.product_name;
    end if;
    select current_stock into v_prev from products where product_id = v_pi.product_id for update;
    if found then
      if not v_allow and v_prev < v_qty then
        raise exception 'Not enough stock of "%" to return (in stock: %)', v_pi.product_name, v_prev;
      end if;
      update products set current_stock = v_prev - v_qty, updated_at = now() where product_id = v_pi.product_id;
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, reference_type,
                                   reference_id, reason, created_by, created_by_id)
      values (v_pi.product_id, 'PURCHASE_RETURN', -v_qty, v_prev, v_prev - v_qty, 'PURCHASE_RETURN', v_pur.purchase_number,
              'Returned to supplier: ' || coalesce(nullif(p_reason, ''), '-'), current_staff_name(), auth.uid());
    end if;
    update purchase_items set returned_qty = returned_qty + v_qty where purchase_item_id = v_pi.purchase_item_id;
    v_value := v_value + round(v_qty * v_pi.unit_cost, 2);
  end loop;
  if v_value = 0 and not exists (select 1 from jsonb_array_elements(p_items) x where coalesce(nullif(x->>'qty', '')::numeric, 0) > 0) then
    raise exception 'Enter a return quantity for at least one item';
  end if;

  perform _purchase_recalc(p_purchase_id);
  if v_value > 0 and v_pur.supplier_id is not null then
    perform _supplier_ledger(v_pur.supplier_id, 'RETURN', 0, v_value, p_purchase_id, v_pur.purchase_number, '',
                             'Returned to supplier: ' || coalesce(nullif(p_reason, ''), '-'));
  end if;
  perform audit('RETURN_PURCHASE', 'PURCHASE', p_purchase_id, jsonb_build_object('value', v_value, 'reason', p_reason));
  return jsonb_build_object('value', v_value);
end $$;

-- ---------------------------------------------------------------------
-- CUSTOMER / SUPPLIER PAYMENTS
-- ---------------------------------------------------------------------

create or replace function public.record_customer_payment(p_customer_id text, p_amount numeric, p_method text default 'CASH',
                                                          p_notes text default '', p_reference text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row     customer_ledger%rowtype;
  v_cust    customers%rowtype;
  v_method  text := upper(coalesce(nullif(p_method, ''), 'CASH'));
begin
  perform _require_admin();
  if p_customer_id = 'WALK-IN' then raise exception 'Walk-in customer has no khata'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Payment amount must be greater than 0'; end if;
  if v_method not in ('CASH', 'CARD', 'ONLINE', 'BANK_TRANSFER', 'CHEQUE') then raise exception 'Unknown payment method'; end if;
  select * into v_cust from customers where customer_id = p_customer_id for update;
  if not found then raise exception 'Customer not found'; end if;

  v_row := _customer_ledger(p_customer_id, 'PAYMENT', 0, round(p_amount, 2), coalesce(nullif(p_reference, ''), 'Khata payment'),
                            v_method, p_notes, case when v_method = 'CASH' then _my_open_shift() end);
  perform audit('CUSTOMER_PAYMENT', 'CUSTOMER', p_customer_id,
    jsonb_build_object('paid', p_amount, 'method', v_method, 'newBalance', v_row.balance_after));
  return to_jsonb(v_row) || jsonb_build_object('customer_name', v_cust.name, 'customer_phone', v_cust.phone,
                                               'balance_before', v_row.balance_after + v_row.credit);
end;
$$;

create or replace function public.adjust_customer_balance(p_customer_id text, p_amount numeric, p_notes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row customer_ledger%rowtype;
begin
  perform _require_admin();
  if coalesce(p_amount, 0) = 0 then raise exception 'Adjustment amount cannot be 0'; end if;
  if length(trim(coalesce(p_notes, ''))) < 3 then raise exception 'Give a reason for the adjustment'; end if;
  v_row := _customer_ledger(p_customer_id, 'ADJUSTMENT', greatest(p_amount, 0), greatest(-p_amount, 0), 'Adjustment', '', p_notes);
  perform audit('CUSTOMER_ADJUSTMENT', 'CUSTOMER', p_customer_id, jsonb_build_object('amount', p_amount, 'notes', p_notes));
  return to_jsonb(v_row);
end $$;

create or replace function public.record_supplier_payment(p_supplier_id text, p_amount numeric, p_reference text default '',
                                                          p_purchase_id text default null, p_method text default 'CASH')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row  supplier_ledger%rowtype;
  v_pur  purchases%rowtype;
begin
  perform _require_admin();
  if coalesce(p_amount, 0) <= 0 then raise exception 'Payment amount must be greater than 0'; end if;
  if nullif(p_purchase_id, '') is not null then
    select * into v_pur from purchases where purchase_id = p_purchase_id for update;
    if not found or v_pur.supplier_id <> p_supplier_id then raise exception 'That purchase order does not belong to this supplier'; end if;
    if v_pur.status = 'CANCELLED' then raise exception 'That purchase order is cancelled'; end if;
  end if;
  v_row := _supplier_ledger(p_supplier_id, 'PAYMENT', 0, round(p_amount, 2), nullif(p_purchase_id, ''),
                            coalesce(nullif(p_reference, ''), v_pur.purchase_number, ''),
                            upper(coalesce(nullif(p_method, ''), 'CASH')), 'Supplier payment');
  if nullif(p_purchase_id, '') is not null then
    update purchases set amount_paid = amount_paid + round(p_amount, 2) where purchase_id = p_purchase_id;
    perform _purchase_recalc(p_purchase_id);
  end if;
  perform audit('SUPPLIER_PAYMENT', 'SUPPLIER', p_supplier_id,
    jsonb_build_object('paid', p_amount, 'newBalance', v_row.balance_after, 'reference', p_reference, 'purchaseId', p_purchase_id));
  return to_jsonb(v_row);
end;
$$;

-- Expense void (kept for audit instead of delete)
create or replace function public.void_expense(p_expense_id text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _require_admin();
  update expenses set status = 'VOIDED', void_reason = coalesce(p_reason, '') where expense_id = p_expense_id;
  if not found then raise exception 'Expense not found'; end if;
end $$;

-- ---------------------------------------------------------------------
-- DASHBOARD + REPORTS (computed in the database, in the store time zone)
-- ---------------------------------------------------------------------

-- Net sale lines after returns. Revenue is before tax, after bill discount.
create or replace function public._net_lines(p_start date, p_end date)
returns table (sale_id text, sale_date date, cashier_id text, cashier_name text, product_id text, product_name text,
               category_id text, qty numeric, revenue numeric, cost numeric)
language sql stable security definer set search_path = public as $$
  select s.sale_id, (s.date at time zone store_tz())::date, s.cashier_id, s.cashier_name, si.product_id, si.product_name,
         pr.category_id,
         si.quantity - si.returned_qty,
         case when si.quantity > 0 then si.line_total * (si.quantity - si.returned_qty) / si.quantity else 0 end
           * case when s.subtotal > 0 then (s.subtotal - s.discount) / s.subtotal else 1 end,
         si.unit_cost * (si.quantity - si.returned_qty)
    from sales s
    join sale_items si on si.sale_id = s.sale_id
    left join products pr on pr.product_id = si.product_id
   where s.status = 'COMPLETED' and (s.date at time zone store_tz())::date between p_start and p_end;
$$;

create or replace function public.dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tz text := store_tz();
  v_today date := store_today();
  v_month_start date := date_trunc('month', store_today())::date;
  v_expiry_days int := setting_num('expiryAlertDays', 30)::int;
begin
  perform _require_admin();
  return (
  with done as (select * from sales where status = 'COMPLETED'),
  today_sales as (select s.* from done s where (s.date at time zone v_tz)::date = v_today),
  low as (
    select product_id, name, sku, current_stock, minimum_stock, unit
      from products where status <> 'INACTIVE' and current_stock <= minimum_stock
  ),
  exp as (
    select product_id, name, sku, current_stock, unit, expiry_date, expiry_date - v_today as days_left
      from products where status <> 'INACTIVE' and expiry_date is not null and expiry_date <= v_today + v_expiry_days
       and current_stock > 0
  )
  select jsonb_build_object(
    'todaySalesTotal',          (select coalesce(sum(total - returned_total), 0) from today_sales),
    'todayCompletedSalesCount', (select count(*) from today_sales),
    'todayGrossProfit',         (select coalesce(sum(revenue - cost), 0) from _net_lines(v_today, v_today)),
    'totalProductsCount',       (select count(*) from products where status <> 'INACTIVE'),
    'lowStockCount',            (select count(*) from low),
    'lowStockItems',            (select coalesce(jsonb_agg(jsonb_build_object(
                                    'productId', product_id, 'name', name, 'sku', sku,
                                    'currentStock', current_stock, 'minimumStock', minimum_stock, 'unit', unit)
                                    order by current_stock - minimum_stock), '[]'::jsonb)
                                   from (select * from low order by current_stock - minimum_stock limit 5) l),
    'expiringCount',            (select count(*) from exp),
    'expiringItems',            (select coalesce(jsonb_agg(jsonb_build_object(
                                    'productId', product_id, 'name', name, 'sku', sku, 'currentStock', current_stock,
                                    'unit', unit, 'expiryDate', expiry_date, 'daysLeft', days_left) order by expiry_date), '[]'::jsonb)
                                   from (select * from exp order by expiry_date limit 8) e),
    'expiryAlertDays',          v_expiry_days,
    'totalExpenses',            (select coalesce(sum(amount), 0) from expenses
                                  where status = 'ACTIVE' and date >= v_month_start and date <= v_today),
    'totalPurchases',           (select coalesce(sum(received_total), 0) from purchases
                                  where status in ('RECEIVED', 'PARTIALLY_RECEIVED')
                                    and (coalesce(received_at, date) at time zone v_tz)::date >= v_month_start),
    'customerReceivables',      (select coalesce(sum(outstanding_balance), 0) from customers where outstanding_balance > 0),
    'supplierPayables',         (select coalesce(sum(outstanding_balance), 0) from suppliers where outstanding_balance > 0),
    'recentSales',              (select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc), '[]'::jsonb)
                                   from (select * from done order by date desc limit 6) r),
    'bestSellingProducts',      (select coalesce(jsonb_agg(jsonb_build_object(
                                    'productId', b.product_id, 'name', b.name,
                                    'totalQuantity', b.qty, 'totalRevenue', b.revenue) order by b.qty desc), '[]'::jsonb)
                                   from (select product_id, max(product_name) as name, sum(qty) as qty, sum(revenue) as revenue
                                           from _net_lines(v_today - 29, v_today)
                                          group by product_id order by qty desc limit 5) b),
    'dailySales',               (select coalesce(jsonb_object_agg(w.d, w.amt), '{}'::jsonb)
                                   from (select ((s.date at time zone v_tz)::date)::text as d, sum(s.total - s.returned_total) as amt
                                           from done s
                                          where (s.date at time zone v_tz)::date > v_today - 7
                                          group by 1) w)
  ));
end;
$$;

create or replace function public._require_reports()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() and not public._perm_bool('canViewReports') then
    raise exception 'You do not have permission to view reports';
  end if;
end $$;

create or replace function public.report_stats(p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tz text := store_tz();
begin
  perform _require_reports();
  return (
  with s as (
    select * from sales where status = 'COMPLETED' and (date at time zone v_tz)::date between p_start and p_end
  ),
  all_s as (
    select * from sales where (date at time zone v_tz)::date between p_start and p_end
  ),
  nl as (select * from _net_lines(p_start, p_end)),
  e as (select * from expenses where status = 'ACTIVE' and date between p_start and p_end),
  pay as (select sp.method, sum(sp.amount) amt from sale_payments sp join all_s on all_s.sale_id = sp.sale_id group by sp.method),
  ret as (select coalesce(sum(refund_amount) filter (where refund_method <> 'CREDIT'), 0) refunds,
                 coalesce(sum(total), 0) returns_value, count(*) cnt
            from sale_returns where (created_at at time zone v_tz)::date between p_start and p_end),
  cp as (select coalesce(sum(credit), 0) amt from customer_ledger
          where type = 'PAYMENT' and (created_at at time zone v_tz)::date between p_start and p_end),
  spay as (select coalesce(sum(credit), 0) amt from supplier_ledger
            where type = 'PAYMENT' and (created_at at time zone v_tz)::date between p_start and p_end),
  agg as (select coalesce(sum(total - returned_total), 0) as rev, coalesce(sum(discount + line_discount_total), 0) as disc,
                 coalesce(sum(case when total > 0 then tax * (total - returned_total) / total else 0 end), 0) as tax,
                 coalesce(sum(returned_total), 0) as returned, count(*) as bills
            from s),
  net as (select coalesce(sum(revenue), 0) r, coalesce(sum(cost), 0) c from nl),
  ex as (select coalesce(sum(amount), 0) as t from e),
  inv as (
    select coalesce(sum(greatest(current_stock, 0) * cost_price), 0) as cv,
           coalesce(sum(greatest(current_stock, 0) * selling_price), 0) as rv
      from products where status <> 'INACTIVE'
  ),
  cash_in as (select coalesce(sum(amt) filter (where method <> 'CREDIT'), 0) paid,
                     coalesce(sum(amt) filter (where method = 'CREDIT'), 0) credit from pay)
  select jsonb_build_object(
    'period',             jsonb_build_object('startDate', p_start, 'endDate', p_end),
    'billCount',          agg.bills,
    'totalSalesRevenue',  agg.rev,
    'netSalesExTax',      net.r,
    'totalCOGS',          net.c,
    'grossProfit',        net.r - net.c,
    'totalExpenses',      ex.t,
    'estimatedNetProfit', net.r - net.c - ex.t,
    'totalDiscount',      agg.disc,
    'totalTax',           agg.tax,
    'totalReturns',       agg.returned,
    'inventoryValuation', jsonb_build_object('costValue', inv.cv, 'retailValue', inv.rv, 'potentialMargin', inv.rv - inv.cv),
    'paymentMethodsBreakdown', (select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from pay),
    'cashFlow', jsonb_build_object(
        'salesPaidNow',      cash_in.paid,
        'creditSales',       cash_in.credit,
        'refunds',           ret.refunds,
        'customerPayments',  cp.amt,
        'supplierPayments',  spay.amt,
        'expenses',          ex.t,
        'cashReceived',      cash_in.paid - ret.refunds + cp.amt,
        'netCashFlow',       cash_in.paid - ret.refunds + cp.amt - spay.amt - ex.t),
    'expenseByCategory',  (select coalesce(jsonb_object_agg(y.cat, y.amt), '{}'::jsonb)
                             from (select coalesce(category, 'MISC') as cat, sum(amount) as amt from e group by 1) y),
    'topProducts',        (select coalesce(jsonb_agg(jsonb_build_object(
                                'name', t.name, 'quantity', t.quantity, 'revenue', t.revenue, 'profit', t.profit)
                                order by t.revenue desc), '[]'::jsonb)
                             from (select max(product_name) as name, sum(qty) as quantity, sum(revenue) as revenue,
                                          sum(revenue - cost) as profit
                                     from nl group by product_id order by revenue desc limit 10) t),
    'profitByCategory',   (select coalesce(jsonb_agg(jsonb_build_object(
                                'category', c.name, 'quantity', c.qty, 'revenue', c.revenue, 'cost', c.cost,
                                'profit', c.revenue - c.cost) order by c.revenue - c.cost desc), '[]'::jsonb)
                             from (select coalesce(cat.name, 'Uncategorised') name, sum(nl.qty) qty, sum(nl.revenue) revenue,
                                          sum(nl.cost) cost
                                     from nl left join categories cat on cat.category_id = nl.category_id
                                    group by 1) c),
    'cashierPerformance', (select coalesce(jsonb_agg(jsonb_build_object(
                                'cashierId', x.cashier_id, 'cashierName', x.cashier_name, 'bills', x.bills,
                                'sales', x.sales, 'averageBill', x.sales / nullif(x.bills, 0), 'discounts', x.disc,
                                'returns', x.returned, 'cancelled', x.cancelled) order by x.sales desc), '[]'::jsonb)
                             from (select cashier_id, max(cashier_name) cashier_name,
                                          count(*) filter (where status = 'COMPLETED') bills,
                                          coalesce(sum(total - returned_total) filter (where status = 'COMPLETED'), 0) sales,
                                          coalesce(sum(discount + line_discount_total) filter (where status = 'COMPLETED'), 0) disc,
                                          coalesce(sum(returned_total) filter (where status = 'COMPLETED'), 0) returned,
                                          count(*) filter (where status = 'CANCELLED') cancelled
                                     from all_s group by cashier_id) x)
  )
  from agg, net, ex, inv, ret, cp, spay, cash_in);
end;
$$;

-- Daily closing: one store day across all shifts
create or replace function public.report_daily_closing(p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tz text := store_tz();
begin
  perform _require_reports();
  return (
  with s as (select * from sales where (date at time zone v_tz)::date = p_date),
  pay as (select sp.method, sum(sp.amount) amt from sale_payments sp join s on s.sale_id = sp.sale_id group by sp.method),
  r as (select * from sale_returns where (created_at at time zone v_tz)::date = p_date),
  k as (select * from customer_ledger where type = 'PAYMENT' and (created_at at time zone v_tz)::date = p_date),
  e as (select * from expenses where status = 'ACTIVE' and date = p_date)
  select jsonb_build_object(
    'date', p_date,
    'billCount', (select count(*) from s where status = 'COMPLETED'),
    'cancelledCount', (select count(*) from s where status = 'CANCELLED'),
    'salesTotal', (select coalesce(sum(total - returned_total), 0) from s where status = 'COMPLETED'),
    'discountTotal', (select coalesce(sum(discount + line_discount_total), 0) from s where status = 'COMPLETED'),
    'taxTotal', (select coalesce(sum(tax), 0) from s where status = 'COMPLETED'),
    'tenders', (select coalesce(jsonb_object_agg(method, amt), '{}'::jsonb) from pay),
    'refunds', (select coalesce(jsonb_object_agg(refund_method, amt), '{}'::jsonb)
                  from (select refund_method, sum(refund_amount) amt from r group by 1) x),
    'returnsValue', (select coalesce(sum(total), 0) from r),
    'khataCollections', (select coalesce(jsonb_object_agg(payment_method, amt), '{}'::jsonb)
                           from (select payment_method, sum(credit) amt from k group by 1) x),
    'expensesTotal', (select coalesce(sum(amount), 0) from e),
    'expensesFromDrawer', (select coalesce(sum(amount), 0) from e where paid_from_drawer),
    'grossProfit', (select coalesce(sum(revenue - cost), 0) from _net_lines(p_date, p_date)),
    'shifts', (select coalesce(jsonb_agg(shift_summary(cs.shift_id) order by cs.opened_at), '[]'::jsonb)
                 from cash_shifts cs
                where (cs.opened_at at time zone v_tz)::date = p_date
                   or (cs.closed_at at time zone v_tz)::date = p_date))
  );
end $$;

create or replace function public.list_shifts(p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_tz text := store_tz();
begin
  perform _require_reports();
  return (select coalesce(jsonb_agg(to_jsonb(cs) order by cs.opened_at desc), '[]'::jsonb)
            from cash_shifts cs where (cs.opened_at at time zone v_tz)::date between p_start and p_end);
end $$;

-- Slow-moving and dead stock: sold quantity in the last N days
create or replace function public.report_slow_moving(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := store_today();
begin
  perform _require_reports();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'productId', p.product_id, 'name', p.name, 'sku', p.sku, 'unit', p.unit,
             'currentStock', p.current_stock, 'stockValue', greatest(p.current_stock, 0) * p.cost_price,
             'soldQty', coalesce(x.qty, 0), 'lastSoldAt', ls.last_sold,
             'isDead', coalesce(x.qty, 0) = 0) order by coalesce(x.qty, 0), greatest(p.current_stock, 0) * p.cost_price desc), '[]'::jsonb)
      from products p
      left join (select product_id, sum(qty) qty from _net_lines(v_today - greatest(p_days, 1) + 1, v_today) group by 1) x
             on x.product_id = p.product_id
      left join (select si.product_id, max(s.date) last_sold from sale_items si join sales s on s.sale_id = si.sale_id
                  where s.status = 'COMPLETED' group by 1) ls on ls.product_id = p.product_id
     where p.status <> 'INACTIVE' and p.current_stock > 0
       and coalesce(x.qty, 0) <= greatest(p.current_stock * 0.1, 0)
  );
end $$;

create or replace function public.report_expiry(p_days int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := store_today();
  v_days int := coalesce(p_days, setting_num('expiryAlertDays', 30)::int);
begin
  perform _require_reports();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'productId', product_id, 'name', name, 'sku', sku, 'unit', unit, 'currentStock', current_stock,
             'expiryDate', expiry_date, 'daysLeft', expiry_date - v_today,
             'stockValue', greatest(current_stock, 0) * cost_price) order by expiry_date), '[]'::jsonb)
      from products
     where status <> 'INACTIVE' and expiry_date is not null and expiry_date <= v_today + v_days
  );
end $$;

-- Khata aging: the balance is matched to the newest debits first (oldest debits are paid first)
create or replace function public.customer_aging()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := store_today(); v_tz text := store_tz();
begin
  perform _require_admin();
  return (
  with c as (select customer_id, name, phone, outstanding_balance b, credit_limit from customers
              where outstanding_balance > 0 and customer_id <> 'WALK-IN'),
  d as (select l.customer_id, l.debit, (l.created_at at time zone v_tz)::date as dt,
               sum(l.debit) over (partition by l.customer_id order by l.created_at desc, l.entry_id desc) as run
          from customer_ledger l join c on c.customer_id = l.customer_id where l.debit > 0),
  a as (select d.customer_id, v_today - d.dt as age,
               greatest(0, least(d.debit, c.b - (d.run - d.debit))) as amt
          from d join c on c.customer_id = d.customer_id),
  g as (select c.customer_id, c.name, c.phone, c.b, c.credit_limit,
               coalesce(sum(a.amt) filter (where a.age <= 30), 0) b0,
               coalesce(sum(a.amt) filter (where a.age between 31 and 60), 0) b31,
               coalesce(sum(a.amt) filter (where a.age between 61 and 90), 0) b61,
               coalesce(sum(a.amt) filter (where a.age > 90), 0) + greatest(0, c.b - coalesce(sum(a.amt), 0)) b90,
               max(a.age) filter (where a.amt > 0) oldest
          from c left join a on a.customer_id = c.customer_id
         group by c.customer_id, c.name, c.phone, c.b, c.credit_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'customerId', customer_id, 'name', name, 'phone', phone, 'balance', b, 'creditLimit', credit_limit,
           'days0to30', b0, 'days31to60', b31, 'days61to90', b61, 'days90plus', b90, 'oldestDays', oldest,
           'isOverdue', (b31 + b61 + b90) > 0) order by b desc), '[]'::jsonb)
    from g);
end $$;

-- ---------------------------------------------------------------------
-- STAFF USERS (Supabase Auth). Username "ali" signs in as ali@grocery.local
-- ---------------------------------------------------------------------

create or replace function public._create_auth_user(p_username text, p_password text, p_full_name text,
                                                    p_role text, p_email text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id        uuid := gen_random_uuid();
  v_username  text := lower(trim(p_username));
  v_email     text := lower(trim(p_username)) || '@grocery.local';
begin
  if v_username !~ '^[a-z0-9._-]+$' then
    raise exception 'Username may only contain letters, numbers, dot, dash and underscore';
  end if;
  if coalesce(p_password, '') = '' then
    raise exception 'Password is required';
  end if;
  if exists (select 1 from public.profiles where username = v_username)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Username "%" already exists', v_username;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('username', v_username), now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());

  insert into public.profiles (id, username, full_name, role, email, status, must_change_password)
  values (v_id, v_username, coalesce(nullif(trim(p_full_name), ''), v_username),
          case when p_role = 'ADMIN' then 'ADMIN' else 'CASHIER' end, coalesce(p_email, ''), 'ACTIVE', true);

  return v_id;
end;
$$;

create or replace function public.admin_save_user(p_user_id uuid, p_username text, p_full_name text, p_role text,
                                                  p_email text, p_password text, p_status text,
                                                  p_permissions jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := p_user_id;
  v_row  public.profiles%rowtype;
  v_perm jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only the store manager can manage staff accounts';
  end if;
  if coalesce(p_password, '') <> '' and length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if p_permissions is not null then
    v_perm := jsonb_strip_nulls(jsonb_build_object(
      'canGiveDiscount', (p_permissions->>'canGiveDiscount')::boolean,
      'maxDiscountPercent', case when nullif(p_permissions->>'maxDiscountPercent', '') is null then null
                                 else least(100, greatest(0, (p_permissions->>'maxDiscountPercent')::numeric)) end,
      'canReturn', (p_permissions->>'canReturn')::boolean,
      'canViewReports', (p_permissions->>'canViewReports')::boolean));
  end if;

  if v_id is null then
    if coalesce(p_password, '') = '' then raise exception 'Password is required for a new user'; end if;
    v_id := public._create_auth_user(p_username, p_password, p_full_name, p_role, p_email);
    if v_perm is not null then update public.profiles set permissions = v_perm where id = v_id; end if;
    perform public.audit('CREATE_USER', 'PROFILE', v_id::text, jsonb_build_object('username', p_username, 'role', p_role));
  else
    if v_id = auth.uid() and (coalesce(p_role, 'ADMIN') <> 'ADMIN' or coalesce(p_status, 'ACTIVE') <> 'ACTIVE') then
      raise exception 'You cannot remove your own admin access';
    end if;

    update public.profiles
       set full_name   = coalesce(nullif(trim(p_full_name), ''), full_name),
           role        = case when p_role in ('ADMIN', 'CASHIER') then p_role else role end,
           email       = coalesce(p_email, email),
           status      = coalesce(nullif(p_status, ''), status),
           permissions = coalesce(v_perm, permissions),
           updated_at  = now()
     where id = v_id;
    if not found then raise exception 'User not found'; end if;

    if coalesce(p_password, '') <> '' then
      update auth.users
         set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
       where id = v_id;
      -- a password set by the manager is temporary: the user must change it at next sign-in
      update public.profiles set must_change_password = (v_id <> auth.uid()) where id = v_id;
    end if;
    perform public.audit('UPDATE_USER', 'PROFILE', v_id::text,
                         jsonb_build_object('role', p_role, 'status', p_status, 'passwordReset', coalesce(p_password, '') <> ''));
  end if;

  select * into v_row from public.profiles where id = v_id;
  return public._profile_json(v_row);
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_username text;
begin
  if not public.is_admin() then
    raise exception 'Only the store manager can manage staff accounts';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  select username into v_username from public.profiles where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  if v_username = 'admin' then
    raise exception 'Cannot delete primary Admin user';
  end if;
  delete from auth.users where id = p_user_id; -- profile row is removed by ON DELETE CASCADE
  perform public.audit('DELETE_USER', 'PROFILE', p_user_id::text, jsonb_build_object('username', v_username));
end;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION PERMISSIONS
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  -- callable by signed-in staff (each function checks the role itself)
  foreach f in array array[
    'public.create_sale(jsonb)', 'public.get_sale_details(text)',
    'public.return_sale_items(text, jsonb, text, text, text)', 'public.cancel_sale(text, text, text)',
    'public.save_product(jsonb)', 'public.delete_product(text, boolean)',
    'public.adjust_stock(text, text, numeric, text)',
    'public.start_stock_count(text, text)', 'public.apply_stock_count(text)', 'public.cancel_stock_count(text)',
    'public.create_purchase(jsonb)', 'public.update_purchase(text, jsonb)', 'public.cancel_purchase(text, text)',
    'public.receive_purchase(text, jsonb)', 'public.confirm_purchase(text)', 'public.return_purchase(text, jsonb, text)',
    'public.record_customer_payment(text, numeric, text, text, text)', 'public.adjust_customer_balance(text, numeric, text)',
    'public.record_supplier_payment(text, numeric, text, text, text)', 'public.void_expense(text, text)',
    'public.dashboard_stats()', 'public.report_stats(date, date)', 'public.report_daily_closing(date)',
    'public.list_shifts(date, date)', 'public.report_slow_moving(int)', 'public.report_expiry(int)',
    'public.customer_aging()',
    'public.open_shift(numeric, text)', 'public.close_shift(text, numeric, text)', 'public.current_shift()',
    'public.shift_summary(text)',
    'public.record_login()', 'public.my_profile()', 'public.my_permissions()', 'public.verify_own_password(text)',
    'public.change_own_password(text, text)', 'public.set_manager_pin(text)', 'public.verify_manager_pin(text)',
    'public.admin_save_user(uuid, text, text, text, text, text, text, jsonb)', 'public.admin_delete_user(uuid)',
    'public.is_staff()', 'public.is_admin()', 'public.store_tz()', 'public.store_today()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- internal helpers: never callable from the API
  foreach f in array array[
    'public._create_auth_user(text, text, text, text, text)', 'public.audit(text, text, text, jsonb)',
    'public._customer_ledger(text, text, numeric, numeric, text, text, text, text)',
    'public._supplier_ledger(text, text, numeric, numeric, text, text, text, text)',
    'public._consume_approval(text, text)', 'public._purchase_recalc(text)', 'public._purchase_items_write(text, jsonb)',
    'public._net_lines(date, date)', 'public.setting(text, text)', 'public.setting_num(text, numeric)',
    'public.current_staff_name()', 'public._my_open_shift()', 'public._perm_bool(text)', 'public._require_admin()',
    'public._require_reports()', 'public._profile_json(public.profiles)', 'public.gen_id(text, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
-- gen_id is used as a column default by inserts that cashiers make (customers, held bills)
grant execute on function public.gen_id(text, int) to authenticated;

revoke execute on function public.public_store_info() from public;
grant execute on function public.public_store_info() to anon, authenticated;

-- ---------------------------------------------------------------------
-- DEFAULT DATA (only inserted if missing)
-- ---------------------------------------------------------------------

insert into public.settings (key, value, description) values
  ('storeName', 'Bismillah Grocery & Supermarket', 'Store Trading Name'),
  ('tagline', 'Quality Fresh Groceries & Everyday Essentials', 'Store Subtitle'),
  ('phone', '+92 300 1234567', 'Contact phone number'),
  ('address', 'Shop # 12, Commercial Market, Main Boulevard, Lahore', 'Physical store location'),
  ('currency', 'PKR', 'ISO Currency Code'),
  ('currencySymbol', 'Rs.', 'Display Currency Symbol'),
  ('taxRate', '0', 'Sales Tax Percentage'),
  ('allowNegativeStock', 'false', 'Allow selling items below zero inventory'),
  ('lowStockDefaultThreshold', '5', 'Default minimum stock alert threshold'),
  ('receiptType', 'thermal80', 'Receipt print format (thermal58, thermal80, a4)'),
  ('receiptFooter', 'Thank you for shopping with us! Freshness Guaranteed.', 'Receipt bottom note'),
  ('timezone', 'Asia/Karachi', 'Store time zone for invoice numbers, days and reports'),
  ('cashierMaxDiscountPercent', '10', 'Highest discount % a cashier may give without manager PIN'),
  ('expiryAlertDays', '30', 'Warn about products expiring within this many days'),
  ('autoLockMinutes', '15', 'Lock the screen after this many idle minutes (0 = never)'),
  ('ntn', '', 'National Tax Number printed on receipts'),
  ('strn', '', 'Sales Tax Registration Number printed on receipts')
on conflict (key) do nothing;

insert into public.customers (customer_id, name, phone, address, outstanding_balance, credit_limit, notes)
values ('WALK-IN', 'Walk-in Customer', '0000000000', 'Counter Sales', 0, 0, 'Default customer for cash sales')
on conflict (customer_id) do nothing;

insert into public.expense_categories (code, name, sort_order) values
  ('RENT', 'Shop Rent & Lease', 10),
  ('ELECTRICITY', 'Electricity & Utilities (LESCO/WAPDA)', 20),
  ('SALARIES', 'Staff Salaries & Daily Wages', 30),
  ('TRANSPORT', 'Stock Transport & Freight', 40),
  ('PACKAGING', 'Packaging Bags & Receipt Paper', 50),
  ('MAINTENANCE', 'Equipment & Shop Maintenance', 60),
  ('REFRESHMENT', 'Tea, Water & Refreshments', 70),
  ('MISCELLANEOUS', 'Miscellaneous Operating Costs', 80)
on conflict (code) do nothing;

-- First-run staff accounts (skipped once any staff profile exists)
do $$
begin
  if not exists (select 1 from public.profiles) then
    perform public._create_auth_user('admin', 'admin@2026', 'Store Manager', 'ADMIN', 'admin@grocery.local');
    perform public._create_auth_user('cashier1', '1234', 'Primary Cashier', 'CASHIER', 'cashier@grocery.local');
  end if;
end $$;

-- Seeded accounts that still use the published default password must change it
update public.profiles p set must_change_password = true
  from auth.users u
 where u.id = p.id and p.must_change_password = false
   and ((p.username = 'admin' and u.encrypted_password = extensions.crypt('admin@2026', u.encrypted_password))
     or (p.username = 'cashier1' and u.encrypted_password = extensions.crypt('1234', u.encrypted_password)));
