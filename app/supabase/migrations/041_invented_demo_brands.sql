-- 041_invented_demo_brands.sql
--
-- The demo data borrowed real companies' names (Aesop, Le Creuset, Patagonia,
-- Glossier…) and showed them as Alamut customers. The app's sample data now
-- uses invented brands; this brings the live database's demo rows in line.
--
-- Run once in the Supabase SQL editor. It is one transaction: if anything
-- fails, nothing changes. It touches only demo content (names inside text);
-- ids, emails, logins and money amounts are left alone, so every account and
-- every balance stays as it is.
--
-- Generated from the same name list the app uses (portal revamp, phase 1).

begin;

-- 1. The two hand-made demo brands: their profiles were the real companies'
--    own copy and websites.
update public.brands set
  name = 'Oakmoss', website = 'oakmoss.example', logo_mark = 'O',
  about = 'Skin, hair and body care, made in small batches in Melbourne.'
where id = 'b_aesop';

update public.brands set
  name = 'Kettle & Ember', website = 'kettleandember.example', logo_mark = 'K',
  hq = 'Lyon, FR',
  about = 'Enamelled cast-iron cookware and kitchen tools, made to be handed down.'
where id = 'b_lecreuset';

-- 2. Every other mention, as a whole name inside text: past clients, press
--    outlets, campaign briefs, offers, reviews, notifications, messages,
--    ledger notes. Longest names first, so "Foodpanda PK" goes before
--    "Foodpanda". Names that are also ordinary words (Hay, Calm, Apple…) are
--    left out here so no sentence gets rewritten by accident.
create temp table _alamut_names (old text, pattern text, new text) on commit drop;
insert into _alamut_names (old, pattern, new) values
  ('Business of Fashion', 'Business\ of\ Fashion', 'Style Ledger'),
  ('Universal Standard', 'Universal\ Standard', 'Every Size Studio'),
  ('Norm Architects', 'Norm\ Architects', 'Quiet Frame Architects'),
  ('Sania Maskatiya', 'Sania\ Maskatiya', 'Noor Atelier'),
  ('Maison Margiela', 'Maison\ Margiela', 'Atelier Ombre'),
  ('Brilliant Earth', 'Brilliant\ Earth', 'Truecut Jewels'),
  ('Drunk Elephant', 'Drunk\ Elephant', 'Clearwater Lab'),
  ('National Foods', 'National\ Foods', 'Masala House Foods'),
  ('Outdoor Voices', 'Outdoor\ Voices', 'Weekend Motion'),
  ('Thousand Fell', 'Thousand\ Fell', 'Loopsole'),
  ('Boll & Branch', 'Boll\ \&\ Branch', 'Cotton & Cove'),
  ('Sapphire Home', 'Sapphire\ Home', 'Indigo Lane Home'),
  ('Hender Scheme', 'Hender\ Scheme', 'Hide & Hand'),
  ('Net-a-Porter', 'Net\-a\-Porter', 'Maison Arcade'),
  ('Aman Resorts', 'Aman\ Resorts', 'Stillwater Retreats'),
  ('Teenage Eng.', 'Teenage\ Eng\.', 'Pocket Synth Co.'),
  ('Foodpanda PK', 'Foodpanda\ PK', 'Tiffin Run'),
  ('Salt & Stone', 'Salt\ \&\ Stone', 'Brine & Birch'),
  ('Trade Coffee', 'Trade\ Coffee', 'Roaster’s Round'),
  ('Liquid Death', 'Liquid\ Death', 'Tallcan Water'),
  ('D&Department', 'D\&Department', 'Long Life Store'),
  ('Tata Harper', 'Tata\ Harper', 'Wildmeadow Botanics'),
  ('Blue Bottle', 'Blue\ Bottle', 'Ridgeback Coffee'),
  ('Peak Design', 'Peak\ Design', 'Carryall Works'),
  ('Reformation', 'Reformation', 'Second Bloom'),
  ('Apartamento', 'Apartamento', 'Casa Diaries'),
  ('Great Jones', 'Great\ Jones', 'Bond Street Pans'),
  ('Magic Spoon', 'Magic\ Spoon', 'Spoonful Protein'),
  ('TenThousand', 'TenThousand', 'Repcount'),
  ('Le Creuset', 'Le\ Creuset', 'Kettle & Ember'),
  ('Soho House', 'Soho\ House', 'Gallery House'),
  ('On Running', 'On\ Running', 'Fellrun'),
  ('Linum & Co', 'Linum\ \&\ Co', 'Flaxroom'),
  ('Outerknown', 'Outerknown', 'Swell & Stitch'),
  ('Death Wish', 'Death\ Wish', 'Midnight Grind'),
  ('Brooklinen', 'Brooklinen', 'Sheetworks'),
  ('Tracksmith', 'Tracksmith', 'Milepost Running'),
  ('Krave Mart', 'Krave\ Mart', 'Kiryana Express'),
  ('Ace Hotel', 'Ace\ Hotel', 'Halden Hotels'),
  ('Lululemon', 'Lululemon', 'Northline Active'),
  ('Patagonia', 'Patagonia', 'Ridgewild Outdoor'),
  ('Skin + Me', 'Skin\ \+\ Me', 'Dermadesk'),
  ('Our Place', 'Our\ Place', 'Common Table'),
  ('Foodpanda', 'Foodpanda', 'Tiffin Run'),
  ('Snow Peak', 'Snow\ Peak', 'Ridgeline Camp'),
  ('Glossier', 'Glossier', 'Petalcourt'),
  ('Made.com', 'Made\.com', 'Roomwell'),
  ('Everlane', 'Everlane', 'Thread & Ledger'),
  ('Alo Yoga', 'Alo\ Yoga', 'Solace Yoga'),
  ('Allbirds', 'Allbirds', 'Woolwalk'),
  ('Diptyque', 'Diptyque', 'Maison Cire'),
  ('Gymshark', 'Gymshark', 'Ironleaf Training'),
  ('West Elm', 'West\ Elm', 'Eastbank Home'),
  ('Tossdown', 'Tossdown', 'Dastarkhwan'),
  ('Postalco', 'Postalco', 'Paperpost Goods'),
  ('Le Labo', 'Le\ Labo', 'Atelier Vesper'),
  ('Iittala', 'Iittala', 'Kivi Glass'),
  ('Maria B', 'Maria\ B', 'Zarina Rehman'),
  ('Kinfolk', 'Kinfolk', 'Hearth Quarterly'),
  ('Olaplex', 'Olaplex', 'Bondwell'),
  ('Faherty', 'Faherty', 'Tidewater Supply'),
  ('Catbird', 'Catbird', 'Wren & Wire'),
  ('Khaadi', 'Khaadi', 'Loomhouse'),
  ('Notpla', 'Notpla', 'Seaweave'),
  ('Olipop', 'Olipop', 'Fizzroot'),
  ('Airbnb', 'Airbnb', 'Hostlane'),
  ('Careem', 'Careem', 'Rahgir'),
  ('Byredo', 'Byredo', 'Sillage Room'),
  ('Sézane', 'Sézane', 'Rue Clémence'),
  ('Mejuri', 'Mejuri', 'Daily Gold Co.'),
  ('Casper', 'Casper', 'Slumberwell'),
  ('Bombas', 'Bombas', 'Footnote Socks'),
  ('Allset', 'Allset', 'Taiyar Apps'),
  ('Cuyana', 'Cuyana', 'Cedar & Silk'),
  ('Aesop', 'Aesop', 'Oakmoss'),
  ('Vitra', 'Vitra', 'Lindqvist Studio'),
  ('OATLY', 'OATLY', 'Oatfield'),
  ('Leica', 'Leica', 'Brennhaus Optics'),
  ('Daraz', 'Daraz', 'Bazaarline'),
  ('Sonos', 'Sonos', 'Roomtone Audio'),
  ('Vuori', 'Vuori', 'Coastline Active'),
  ('Bykea', 'Bykea', 'Chalo Rides'),
  ('Buffy', 'Buffy', 'Cloudnest Bedding'),
  ('Vogue', 'Vogue', 'Field & Frame'),
  ('Muji', 'Muji', 'Plainday'),
  ('Tibi', 'Tibi', 'Marlow Grey'),
  ('Bose', 'Bose', 'Clearhall Sound'),
  ('Smeg', 'Smeg', 'Pastello');

do $$
declare
  col record;
  nm record;
  pat text;
  ver text;
  n bigint;
  total bigint := 0;
begin
  for col in
    select c.table_name as t, c.column_name as c, c.data_type as dt, c.udt_name as udt
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and tb.table_type = 'BASE TABLE'
      and c.table_name = any (array['brands', 'campaigns', 'creators', 'applications', 'offers', 'submissions', 'deliverables', 'contracts', 'reviews', 'disputes', 'outreach', 'collaborations', 'spark_drafts', 'transactions', 'team_invites', 'notifications', 'threads', 'messages'])
      and (c.data_type in ('text', 'character varying', 'jsonb')
           or (c.data_type = 'ARRAY' and c.udt_name = '_text'))
      and c.column_name <> 'id'
      and c.column_name not like '%\_id' escape '\'
      and c.column_name not like '%email%'
      and c.column_name not like '%url%'
      and c.column_name not like '%token%'
      and c.column_name not like '%hash%'
      and c.column_name not in ('permalink', 'storage_path', 'path', 'website')
  loop
    -- Tables with an optimistic-lock column get it bumped, so a browser
    -- still holding the old row can't write the old name back.
    select case when exists (
      select 1 from information_schema.columns v
      where v.table_schema = 'public' and v.table_name = col.t and v.column_name = 'version'
    ) then ', version = version + 1' else '' end into ver;

    for nm in select * from _alamut_names loop
      pat := '(?<![[:alnum:]_@.])' || nm.pattern || '(?![[:alnum:]_])';
      if col.dt = 'jsonb' then
        execute format(
          'update public.%I set %I = regexp_replace(%I::text, %L, %L, ''g'')::jsonb%s where %I::text ~ %L',
          col.t, col.c, col.c, pat, nm.new, ver, col.c, pat);
      elsif col.dt = 'ARRAY' then
        execute format(
          'update public.%I set %I = array(select regexp_replace(x, %L, %L, ''g'') from unnest(%I) with ordinality u(x, i) order by i)%s where array_to_string(%I, chr(31)) ~ %L',
          col.t, col.c, pat, nm.new, col.c, ver, col.c, pat);
      else
        execute format(
          'update public.%I set %I = regexp_replace(%I, %L, %L, ''g'')%s where %I ~ %L',
          col.t, col.c, col.c, pat, nm.new, ver, col.c, pat);
      end if;
      get diagnostics n = row_count;
      if n > 0 then
        raise notice '%.%: % → % (% rows)', col.t, col.c, nm.old, nm.new, n;
        total := total + n;
      end if;
    end loop;
  end loop;
  raise notice 'done: % row updates', total;
end $$;

commit;

-- 3. Check: both lines should read the new names.
select id, name, website from public.brands where id in ('b_aesop', 'b_lecreuset') order by id;
select id, past_clients, press_mentions from public.creators where id in ('c_sarah', 'c_amir', 'c_yuki') order by id;
