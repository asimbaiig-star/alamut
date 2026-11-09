-- 044_creator_portraits.sql — nobody but the demo creators wears a stock face.
--
-- The storefront editor's only avatar choice was eight stock photos of real
-- people, the first three being the demo's Sarah, Amir and Yuki. On the
-- live site two accounts ("Beta One Creator", "Prod Launch Test") wear
-- Sarah's face, so a brand on Discover sees three Sarahs. The editor now
-- uploads the creator's own photo instead (to the creator-portraits bucket
-- 004 already made; 027's listing lockdown is unchanged). This returns
-- anyone but the three demo creators who still has a stock photo to their
-- initials ('' renders them, 004's default) until they upload one.
--
-- Every stock photo the app ever offered or seeded is an images.unsplash
-- URL; an upload is a storage URL or inline data, so it is never touched.
-- The public projection (038) picks the change up through its trigger.
--
-- Safe to run more than once.

update public.creators
   set portrait = ''
 where id not in ('c_sarah', 'c_amir', 'c_yuki')
   and portrait like 'https://images.unsplash.com/%';

-- Check: only Sarah, Amir and Yuki should still show an unsplash photo.
select id, name, left(portrait, 60) as portrait
  from public.creators
 order by id;
