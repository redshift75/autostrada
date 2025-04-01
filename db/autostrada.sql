create table public.bat_completed_auctions (
  id serial not null,
  listing_id text not null,
  url text not null,
  title text not null,
  image_url text null,
  sold_price integer null,
  end_date timestamp without time zone null,
  bid_amount integer null,
  bid_date timestamp without time zone null,
  status text null,
  year integer null,
  make text null,
  model text null,
  exterior_color text null,
  normalized_color text null,
  source_file text null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  mileage integer null,
  bidders integer null,
  watchers integer null,
  comments integer null,
  transmission text null,
  constraint bat_completed_auctions_pkey primary key (id),
  constraint bat_completed_auctions_listing_id_key unique (listing_id)
) TABLESPACE pg_default;

create table public.allcars (
  "ID" bigint not null,
  make text null,
  model text null,
  basemodel text null,
  combinedmpg bigint null,
  cylinders bigint null,
  displacement double precision null,
  drive text null,
  engine text null,
  fuel text null,
  transmission text null,
  vehiclesize text null,
  year bigint null,
  created text null,
  modified text null,
  constraint allcars_pkey primary key ("ID"),
  constraint allcars_ID_key unique ("ID")
) TABLESPACE pg_default;

create table public.bat_makes (
  make text not null,
  constraint batmakes_pkey primary key (make)
) TABLESPACE pg_default;

create view public.all_makes as
select distinct
  bat_completed_auctions.make
from
  bat_completed_auctions
where
  bat_completed_auctions.make is not null;

create index IF not exists idx_completed_make_model on public.bat_completed_auctions using btree (make, model) TABLESPACE pg_default;

create index IF not exists idx_completed_year on public.bat_completed_auctions using btree (year) TABLESPACE pg_default;

create index IF not exists idx_completed_status on public.bat_completed_auctions using btree (status) TABLESPACE pg_default;

create index IF not exists idx_completed_sold_price on public.bat_completed_auctions using btree (sold_price) TABLESPACE pg_default;

create trigger update_bat_completed_auctions_updated_at BEFORE
update on bat_completed_auctions for EACH row
execute FUNCTION update_updated_at_column ();

create table public.bat_active_auctions (
  id integer not null default nextval('bat_completed_auctions_id_seq'::regclass),
  listing_id text not null,
  url text not null,
  title text not null,
  image_url text null,
  current_bid integer null,
  status text null,
  year integer null,
  make text null,
  model text null,
  source_file text null,
  created_at timestamp without time zone null default now(),
  updated_at timestamp without time zone null default now(),
  mileage integer null,
  bidders integer null,
  watchers integer null,
  comments integer null,
  transmission text null,
  exterior_color text null,
  normalized_color text null,
  location text null,
  no_reserve boolean null,
  premium boolean null,
  "endDate" bigint null,
  predicted_price integer null,
  constraint bat_active_actions_listing_id_key unique (listing_id)
) TABLESPACE pg_default;

create index IF not exists bat_active_actions_make_model_idx on public.bat_active_auctions using btree (make, model) TABLESPACE pg_default;

create index IF not exists bat_active_actions_year_idx on public.bat_active_auctions using btree (year) TABLESPACE pg_default;

create index IF not exists bat_active_actions_status_idx on public.bat_active_auctions using btree (status) TABLESPACE pg_default;