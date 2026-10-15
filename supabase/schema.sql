-- =====================================================================
-- Grocery Store Management System - Supabase (Postgres) Schema
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> New query -> paste this whole
--   file -> Run. Safe to run again (uses IF NOT EXISTS / OR REPLACE).
--
-- Creates:
--   * All tables (same fields as the old Google Sheets tabs)
--   * Row Level Security: only logged-in, ACTIVE staff can read/write
--   * Atomic functions for sales, cancellations, stock, purchases
--   * Dashboard + report aggregate functions (computed in the database)
--   * Staff user management (passwords stored as bcrypt hashes)
--   * First-run accounts:  admin / admin@2026   and   cashier1 / 1234
--     (change both from the Users page after first login)
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Short readable IDs like PROD-1A2B3C4D (same style as the Sheets version)
create or replace function public.gen_id(prefix text, len int default 8)
returns text language sql volatile set search_path = '' as $$
  select prefix || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, len));
$$;

-- ---------------------------------------------------------------------
-- TABLES
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
  status               text not null default 'PENDING',
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

create table if not exists public.expenses (
  expense_id      text primary key default public.gen_id('EXP-'),
  title           text not null,
  category        text default 'MISCELLANEOUS',
  amount          numeric(12,2) not null default 0,
  date            date not null default current_date,
  payment_method  text default 'CASH',
  reference       text default '',
  notes           text default '',
  created_by      text default 'Admin',
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

-- ---------------------------------------------------------------------
-- ACCESS HELPERS + ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE' and role = 'ADMIN');
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','customers','suppliers','sales','sale_items',
    'purchases','purchase_items','expenses','stock_movements','settings','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "staff full access" on public.%I', t);
    execute format(
      'create policy "staff full access" on public.%I for all to authenticated
         using ((select public.is_staff())) with check ((select public.is_staff()))', t);
  end loop;
end $$;

-- Store name/tagline are shown on the login screen before anyone signs in
drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select to anon using (true);

-- Profiles: staff can read; changes only through the admin_* functions below
alter table public.profiles enable row level security;
drop policy if exists "staff read profiles" on public.profiles;
create policy "staff read profiles" on public.profiles for select to authenticated
  using ((select public.is_staff()) or id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.settings to anon;

-- ---------------------------------------------------------------------
-- AUDIT HELPER
-- ---------------------------------------------------------------------

create or replace function public.log_audit(p_user_name text, p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security invoker set search_path = public as $$
  insert into audit_logs (user_id, user_name, action, entity, entity_id, details)
  values (coalesce(auth.uid()::text, 'SYSTEM'), coalesce(p_user_name, ''), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- POS: CREATE SALE (atomic: sale + items + stock deduction + credit)
-- ---------------------------------------------------------------------

create or replace function public.create_sale(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_items           jsonb := coalesce(p->'items', '[]'::jsonb);
  v_item            jsonb;
  v_prod            products%rowtype;
  v_allow_negative  boolean;
  v_qty             numeric;
  v_unit_price      numeric;
  v_line_discount   numeric;
  v_now             timestamptz := now();
  v_prefix          text;
  v_seq             int;
  v_invoice         text;
  v_sale            sales%rowtype;
  v_si              sale_items%rowtype;
  v_items_out       jsonb := '[]'::jsonb;
  v_method          text := coalesce(nullif(p->>'paymentMethod', ''), 'CASH');
  v_customer        text := coalesce(nullif(p->>'customerId', ''), 'WALK-IN');
  v_cashier_name    text := coalesce(nullif(p->>'cashierName', ''), 'Cashier');
  v_total           numeric := coalesce(nullif(p->>'total', '')::numeric, 0);
begin
  if jsonb_array_length(v_items) = 0 then
    raise exception 'Cannot checkout with an empty cart';
  end if;

  select coalesce((select value from settings where key = 'allowNegativeStock'), 'false') = 'true'
    into v_allow_negative;

  -- Lock every product row (sorted to avoid deadlocks) and validate stock
  for v_item in select value from jsonb_array_elements(v_items) order by value->>'productId' loop
    select * into v_prod from products where product_id = v_item->>'productId' for update;
    if not found then
      raise exception 'Product not found: %', coalesce(v_item->>'name', v_item->>'productName', v_item->>'productId');
    end if;
    v_qty := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for "%"', v_prod.name;
    end if;
    if not v_allow_negative and v_prod.current_stock < v_qty then
      raise exception 'Insufficient stock for "%". Available: %, Requested: %', v_prod.name, v_prod.current_stock, v_qty;
    end if;
  end loop;

  -- Sequential invoice number per day: INV-YYYYMMDD-0001 (store local date)
  perform pg_advisory_xact_lock(hashtext('sales_invoice_seq'));
  v_prefix := 'INV-' || to_char(v_now at time zone 'Asia/Karachi', 'YYYYMMDD') || '-';
  select coalesce(max(nullif(regexp_replace(substr(invoice_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1
    into v_seq from sales where invoice_number like v_prefix || '%';
  v_invoice := v_prefix || lpad(v_seq::text, 4, '0');

  insert into sales (sale_id, invoice_number, date, cashier_id, cashier_name, customer_id, customer_name,
                     subtotal, discount, tax, total, amount_paid, change, payment_method, payment_status,
                     status, notes, created_at)
  values (gen_id('SALE-'), v_invoice, v_now,
          coalesce(nullif(p->>'cashierId', ''), 'CASHIER-1'), v_cashier_name,
          v_customer, coalesce(nullif(p->>'customerName', ''), 'Walk-in Customer'),
          coalesce(nullif(p->>'subtotal', '')::numeric, 0),
          coalesce(nullif(p->>'discount', '')::numeric, 0),
          coalesce(nullif(p->>'tax', '')::numeric, 0),
          v_total,
          case when v_method = 'CREDIT' then coalesce(nullif(p->>'amountPaid', '')::numeric, 0)
               else coalesce(nullif(nullif(p->>'amountPaid', '')::numeric, 0), v_total) end,
          coalesce(nullif(p->>'change', '')::numeric, 0),
          v_method,
          case when v_method = 'CREDIT' then 'UNPAID' else 'PAID' end,
          'COMPLETED', coalesce(p->>'notes', ''), v_now)
  returning * into v_sale;

  for v_item in select value from jsonb_array_elements(v_items) loop
    select * into v_prod from products where product_id = v_item->>'productId';
    v_qty := (v_item->>'quantity')::numeric;
    v_unit_price := coalesce(nullif(v_item->>'sellingPrice', '')::numeric,
                             nullif(v_item->>'unitPrice', '')::numeric,
                             v_prod.selling_price);
    v_line_discount := coalesce(nullif(v_item->>'discount', '')::numeric, 0);

    insert into sale_items (sale_id, product_id, product_name, quantity, unit, unit_price, unit_cost, discount, line_total, created_at)
    values (v_sale.sale_id, v_prod.product_id, v_prod.name, v_qty, coalesce(v_prod.unit, 'piece'),
            v_unit_price, v_prod.cost_price, v_line_discount, v_unit_price * v_qty - v_line_discount, v_now)
    returning * into v_si;
    v_items_out := v_items_out || to_jsonb(v_si);

    update products set current_stock = current_stock - v_qty, updated_at = v_now
     where product_id = v_prod.product_id;

    insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock,
                                 reference_type, reference_id, reason, created_by, created_at)
    values (v_prod.product_id, 'SALE', -v_qty, v_prod.current_stock, v_prod.current_stock - v_qty,
            'INVOICE', v_invoice, 'POS Sale ' || v_invoice, v_cashier_name, v_now);
  end loop;

  if v_method = 'CREDIT' and v_customer <> 'WALK-IN' then
    update customers set outstanding_balance = outstanding_balance + v_total, updated_at = v_now
     where customer_id = v_customer;
  end if;

  perform log_audit(v_cashier_name, 'CREATE_SALE', 'SALE', v_sale.sale_id,
    jsonb_build_object('invoiceNumber', v_invoice, 'total', v_total, 'itemCount', jsonb_array_length(v_items)));

  return jsonb_build_object('sale', to_jsonb(v_sale), 'items', v_items_out);
end;
$$;

-- ---------------------------------------------------------------------
-- CANCEL SALE (restock + revert customer credit)
-- ---------------------------------------------------------------------

create or replace function public.cancel_sale(p_sale_id text, p_reason text default '', p_authorized_by text default 'Manager')
returns text language plpgsql security invoker set search_path = public as $$
declare
  v_sale  sales%rowtype;
  v_si    sale_items%rowtype;
  v_new   numeric;
  v_now   timestamptz := now();
begin
  select * into v_sale from sales where sale_id = p_sale_id for update;
  if not found then raise exception 'Sale record not found'; end if;
  if v_sale.status = 'CANCELLED' then raise exception 'Sale is already cancelled'; end if;

  for v_si in select * from sale_items where sale_id = p_sale_id order by product_id loop
    update products set current_stock = current_stock + v_si.quantity, updated_at = v_now
     where product_id = v_si.product_id
    returning current_stock into v_new;
    if found then
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock,
                                   reference_type, reference_id, reason, created_by, created_at)
      values (v_si.product_id, 'SALE_RETURN', v_si.quantity, v_new - v_si.quantity, v_new,
              'SALE_CANCEL', v_sale.invoice_number,
              'Cancelled sale: ' || coalesce(nullif(p_reason, ''), 'Customer Return'),
              coalesce(nullif(p_authorized_by, ''), 'Manager'), v_now);
    end if;
  end loop;

  if v_sale.payment_method = 'CREDIT' and coalesce(v_sale.customer_id, 'WALK-IN') <> 'WALK-IN' then
    update customers set outstanding_balance = greatest(0, outstanding_balance - v_sale.total), updated_at = v_now
     where customer_id = v_sale.customer_id;
  end if;

  update sales
     set status = 'CANCELLED',
         notes = case when coalesce(notes, '') = '' then '' else notes || ' | ' end
                 || 'Cancelled: ' || coalesce(nullif(p_reason, ''), 'No reason given')
   where sale_id = p_sale_id;

  perform log_audit(p_authorized_by, 'CANCEL_SALE', 'SALE', p_sale_id,
    jsonb_build_object('invoiceNumber', v_sale.invoice_number, 'reason', p_reason));

  return 'Sale ' || v_sale.invoice_number || ' cancelled and inventory restored';
end;
$$;

-- ---------------------------------------------------------------------
-- MANUAL STOCK ADJUSTMENT
-- ---------------------------------------------------------------------

create or replace function public.adjust_stock(p_product_id text, p_adjustment_type text, p_quantity numeric,
                                               p_reason text default '', p_created_by text default 'Manager')
returns numeric language plpgsql security invoker set search_path = public as $$
declare
  v_qty   numeric := abs(coalesce(p_quantity, 0));
  v_prev  numeric;
  v_new   numeric;
begin
  if v_qty <= 0 then raise exception 'Adjustment quantity must be greater than 0'; end if;

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
                               reference_type, reference_id, reason, created_by)
  values (p_product_id, 'ADJUSTMENT', v_new - v_prev, v_prev, v_new, 'MANUAL_ADJUSTMENT',
          'ADJ-' || (extract(epoch from now()) * 1000)::bigint,
          coalesce(nullif(p_reason, ''), 'Manual stock adjustment'),
          coalesce(nullif(p_created_by, ''), 'Manager'));

  perform log_audit(p_created_by, 'ADJUST_STOCK', 'PRODUCT', p_product_id,
    jsonb_build_object('prevStock', v_prev, 'newStock', v_new, 'reason', p_reason));

  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- PURCHASES
-- ---------------------------------------------------------------------

create or replace function public.create_purchase(p jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_items     jsonb := coalesce(p->'items', '[]'::jsonb);
  v_item      jsonb;
  v_subtotal  numeric := 0;
  v_paid      numeric := coalesce(nullif(p->>'amountPaid', '')::numeric, 0);
  v_prefix    text;
  v_seq       int;
  v_purchase  purchases%rowtype;
begin
  if jsonb_array_length(v_items) = 0 then
    raise exception 'Purchase must contain at least one item';
  end if;

  select coalesce(sum(coalesce(nullif(value->>'quantity', '')::numeric, 0) * coalesce(nullif(value->>'unitCost', '')::numeric, 0)), 0)
    into v_subtotal from jsonb_array_elements(v_items);

  perform pg_advisory_xact_lock(hashtext('purchase_number_seq'));
  v_prefix := 'PO-' || to_char(now() at time zone 'Asia/Karachi', 'YYYYMMDD') || '-';
  select coalesce(max(nullif(regexp_replace(substr(purchase_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int), 0) + 1
    into v_seq from purchases where purchase_number like v_prefix || '%';

  insert into purchases (purchase_number, supplier_id, supplier_name, subtotal, tax, total, amount_paid,
                         outstanding_balance, status, notes)
  values (v_prefix || lpad(v_seq::text, 3, '0'), p->>'supplierId', coalesce(nullif(p->>'supplierName', ''), 'Supplier'),
          v_subtotal, 0, v_subtotal, v_paid, v_subtotal - v_paid, 'PENDING', coalesce(p->>'notes', ''))
  returning * into v_purchase;

  for v_item in select value from jsonb_array_elements(v_items) loop
    insert into purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    values (v_purchase.purchase_id, v_item->>'productId', v_item->>'productName',
            coalesce(nullif(v_item->>'quantity', '')::numeric, 0),
            coalesce(nullif(v_item->>'unitCost', '')::numeric, 0),
            coalesce(nullif(v_item->>'quantity', '')::numeric, 0) * coalesce(nullif(v_item->>'unitCost', '')::numeric, 0));
  end loop;

  perform log_audit('Purchasing', 'CREATE_PURCHASE', 'PURCHASE', v_purchase.purchase_id,
    jsonb_build_object('purchaseNumber', v_purchase.purchase_number, 'total', v_subtotal));

  return to_jsonb(v_purchase);
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id text)
returns text language plpgsql security invoker set search_path = public as $$
declare
  v_pur  purchases%rowtype;
  v_pi   purchase_items%rowtype;
  v_new  numeric;
begin
  select * into v_pur from purchases where purchase_id = p_purchase_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_pur.status = 'CONFIRMED' then raise exception 'Purchase order is already confirmed'; end if;

  for v_pi in select * from purchase_items where purchase_id = p_purchase_id order by product_id loop
    update products
       set current_stock = current_stock + v_pi.quantity,
           cost_price = case when v_pi.unit_cost > 0 then v_pi.unit_cost else cost_price end,
           updated_at = now()
     where product_id = v_pi.product_id
    returning current_stock into v_new;
    if found then
      insert into stock_movements (product_id, movement_type, quantity, previous_stock, new_stock,
                                   reference_type, reference_id, reason, created_by)
      values (v_pi.product_id, 'PURCHASE', v_pi.quantity, v_new - v_pi.quantity, v_new,
              'PURCHASE_ORDER', v_pur.purchase_number, 'Stock received from ' || coalesce(v_pur.supplier_name, 'supplier'),
              'Warehouse/Admin');
    end if;
  end loop;

  if v_pur.outstanding_balance > 0 and v_pur.supplier_id is not null then
    update suppliers set outstanding_balance = outstanding_balance + v_pur.outstanding_balance, updated_at = now()
     where supplier_id = v_pur.supplier_id;
  end if;

  update purchases set status = 'CONFIRMED' where purchase_id = p_purchase_id;

  perform log_audit('Admin', 'CONFIRM_PURCHASE', 'PURCHASE', p_purchase_id,
    jsonb_build_object('purchaseNumber', v_pur.purchase_number));

  return 'Purchase confirmed. Inventory updated.';
end;
$$;

-- ---------------------------------------------------------------------
-- CUSTOMER / SUPPLIER PAYMENTS
-- ---------------------------------------------------------------------

create or replace function public.record_customer_payment(p_customer_id text, p_amount numeric)
returns numeric language plpgsql security invoker set search_path = public as $$
declare v_new numeric;
begin
  update customers set outstanding_balance = greatest(0, outstanding_balance - coalesce(p_amount, 0)), updated_at = now()
   where customer_id = p_customer_id
  returning outstanding_balance into v_new;
  if not found then raise exception 'Customer not found'; end if;
  perform log_audit('Cashier', 'CUSTOMER_PAYMENT', 'CUSTOMER', p_customer_id,
    jsonb_build_object('paid', p_amount, 'newBalance', v_new));
  return v_new;
end;
$$;

create or replace function public.record_supplier_payment(p_supplier_id text, p_amount numeric, p_reference text default '')
returns numeric language plpgsql security invoker set search_path = public as $$
declare v_new numeric;
begin
  update suppliers set outstanding_balance = greatest(0, outstanding_balance - coalesce(p_amount, 0)), updated_at = now()
   where supplier_id = p_supplier_id
  returning outstanding_balance into v_new;
  if not found then raise exception 'Supplier not found'; end if;
  perform log_audit('Admin', 'SUPPLIER_PAYMENT', 'SUPPLIER', p_supplier_id,
    jsonb_build_object('paid', p_amount, 'newBalance', v_new, 'reference', p_reference));
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- DASHBOARD + REPORTS (aggregated in the database)
-- ---------------------------------------------------------------------

create or replace function public.dashboard_stats(p_tz text default 'Asia/Karachi')
returns jsonb language sql stable security invoker set search_path = public as $$
  with today as (select (now() at time zone p_tz)::date as d),
  done as (select * from sales where status = 'COMPLETED'),
  today_sales as (select s.* from done s, today where (s.date at time zone p_tz)::date = today.d),
  low as (
    select product_id, name, sku, current_stock, minimum_stock, unit
      from products where status <> 'INACTIVE' and current_stock <= minimum_stock
  )
  select jsonb_build_object(
    'todaySalesTotal',          (select coalesce(sum(total), 0) from today_sales),
    'todayCompletedSalesCount', (select count(*) from today_sales),
    'todayGrossProfit',         (select coalesce(sum(si.line_total - si.unit_cost * si.quantity), 0)
                                   from sale_items si join today_sales t on t.sale_id = si.sale_id),
    'totalProductsCount',       (select count(*) from products where status <> 'INACTIVE'),
    'lowStockCount',            (select count(*) from low),
    'lowStockItems',            (select coalesce(jsonb_agg(jsonb_build_object(
                                    'productId', product_id, 'name', name, 'sku', sku,
                                    'currentStock', current_stock, 'minimumStock', minimum_stock, 'unit', unit)
                                    order by current_stock - minimum_stock), '[]'::jsonb)
                                   from (select * from low order by current_stock - minimum_stock limit 5) l),
    'totalExpenses',            (select coalesce(sum(amount), 0) from expenses),
    'totalPurchases',           (select coalesce(sum(total), 0) from purchases where status in ('CONFIRMED', 'COMPLETED')),
    'recentSales',              (select coalesce(jsonb_agg(to_jsonb(r) order by r.date desc), '[]'::jsonb)
                                   from (select * from done order by date desc limit 6) r),
    'bestSellingProducts',      (select coalesce(jsonb_agg(jsonb_build_object(
                                    'productId', b.product_id, 'name', b.name,
                                    'totalQuantity', b.qty, 'totalRevenue', b.revenue) order by b.qty desc), '[]'::jsonb)
                                   from (select si.product_id, max(si.product_name) as name,
                                                sum(si.quantity) as qty, sum(si.line_total) as revenue
                                           from sale_items si join done s on s.sale_id = si.sale_id
                                          group by si.product_id order by qty desc limit 5) b),
    'dailySales',               (select coalesce(jsonb_object_agg(w.d, w.amt), '{}'::jsonb)
                                   from (select ((s.date at time zone p_tz)::date)::text as d, sum(s.total) as amt
                                           from done s, today
                                          where (s.date at time zone p_tz)::date > today.d - 7
                                          group by 1) w)
  );
$$;

create or replace function public.report_stats(p_start date, p_end date, p_tz text default 'Asia/Karachi')
returns jsonb language sql stable security invoker set search_path = public as $$
  with s as (
    select * from sales
     where status = 'COMPLETED' and (date at time zone p_tz)::date between p_start and p_end
  ),
  i as (select si.* from sale_items si join s on s.sale_id = si.sale_id),
  e as (select * from expenses where date between p_start and p_end),
  agg as (select coalesce(sum(total), 0) as rev, coalesce(sum(discount), 0) as disc, coalesce(sum(tax), 0) as tax from s),
  cogs as (select coalesce(sum(unit_cost * quantity), 0) as c from i),
  ex as (select coalesce(sum(amount), 0) as t from e),
  inv as (
    select coalesce(sum(current_stock * cost_price), 0) as cv, coalesce(sum(current_stock * selling_price), 0) as rv
      from products where status <> 'INACTIVE'
  )
  select jsonb_build_object(
    'period',             jsonb_build_object('startDate', p_start, 'endDate', p_end),
    'totalSalesRevenue',  agg.rev,
    'totalCOGS',          cogs.c,
    'grossProfit',        agg.rev - cogs.c,
    'totalExpenses',      ex.t,
    'estimatedNetProfit', agg.rev - cogs.c - ex.t,
    'totalDiscount',      agg.disc,
    'totalTax',           agg.tax,
    'inventoryValuation', jsonb_build_object('costValue', inv.cv, 'retailValue', inv.rv, 'potentialMargin', inv.rv - inv.cv),
    'paymentMethodsBreakdown', (select coalesce(jsonb_object_agg(x.pm, x.amt), '{}'::jsonb)
                                  from (select coalesce(payment_method, 'OTHER') as pm, sum(total) as amt from s group by 1) x),
    'expenseByCategory',  (select coalesce(jsonb_object_agg(y.cat, y.amt), '{}'::jsonb)
                             from (select coalesce(category, 'MISC') as cat, sum(amount) as amt from e group by 1) y),
    'topProducts',        (select coalesce(jsonb_agg(jsonb_build_object(
                                'name', t.name, 'quantity', t.quantity, 'revenue', t.revenue, 'profit', t.profit)
                                order by t.revenue desc), '[]'::jsonb)
                             from (select max(product_name) as name, sum(quantity) as quantity, sum(line_total) as revenue,
                                          sum(line_total - unit_cost * quantity) as profit
                                     from i group by product_id order by revenue desc limit 10) t)
  )
  from agg, cogs, ex, inv;
$$;

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
    raise exception 'Password / PIN is required';
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

  insert into public.profiles (id, username, full_name, role, email, status)
  values (v_id, v_username, coalesce(nullif(trim(p_full_name), ''), v_username),
          case when p_role = 'ADMIN' then 'ADMIN' else 'CASHIER' end, coalesce(p_email, ''), 'ACTIVE');

  return v_id;
end;
$$;

create or replace function public.admin_save_user(p_user_id uuid, p_username text, p_full_name text, p_role text,
                                                  p_email text, p_password text, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id   uuid := p_user_id;
  v_row  public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only the store manager can manage staff accounts';
  end if;

  if v_id is null then
    v_id := public._create_auth_user(p_username, p_password, p_full_name, p_role, p_email);
  else
    if v_id = auth.uid() and (coalesce(p_role, 'ADMIN') <> 'ADMIN' or coalesce(p_status, 'ACTIVE') <> 'ACTIVE') then
      raise exception 'You cannot remove your own admin access';
    end if;

    update public.profiles
       set full_name  = coalesce(nullif(trim(p_full_name), ''), full_name),
           role       = case when p_role in ('ADMIN', 'CASHIER') then p_role else role end,
           email      = coalesce(p_email, email),
           status     = coalesce(nullif(p_status, ''), status),
           updated_at = now()
     where id = v_id;
    if not found then raise exception 'User not found'; end if;

    if coalesce(p_password, '') <> '' then
      update auth.users
         set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
       where id = v_id;
    end if;
  end if;

  select * into v_row from public.profiles where id = v_id;
  return to_jsonb(v_row);
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
end;
$$;

-- Function permissions: nothing callable without login; internal helper not callable at all
do $$
declare f text;
begin
  foreach f in array array[
    'public.gen_id(text, int)', 'public.log_audit(text, text, text, text, jsonb)',
    'public.create_sale(jsonb)', 'public.cancel_sale(text, text, text)',
    'public.adjust_stock(text, text, numeric, text, text)', 'public.create_purchase(jsonb)',
    'public.confirm_purchase(text)', 'public.record_customer_payment(text, numeric)',
    'public.record_supplier_payment(text, numeric, text)', 'public.dashboard_stats(text)',
    'public.report_stats(date, date, text)',
    'public.admin_save_user(uuid, text, text, text, text, text, text)', 'public.admin_delete_user(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke execute on function public._create_auth_user(text, text, text, text, text) from public, anon, authenticated;

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
  ('receiptFooter', 'Thank you for shopping with us! Freshness Guaranteed.', 'Receipt bottom note')
on conflict (key) do nothing;

insert into public.customers (customer_id, name, phone, address, outstanding_balance, credit_limit, notes)
values ('WALK-IN', 'Walk-in Customer', '0000000000', 'Counter Sales', 0, 0, 'Default customer for cash sales')
on conflict (customer_id) do nothing;

-- First-run staff accounts (skipped once any staff profile exists)
do $$
begin
  if not exists (select 1 from public.profiles) then
    perform public._create_auth_user('admin', 'admin@2026', 'Store Manager', 'ADMIN', 'admin@grocery.local');
    perform public._create_auth_user('cashier1', '1234', 'Primary Cashier', 'CASHIER', 'cashier@grocery.local');
  end if;
end $$;
