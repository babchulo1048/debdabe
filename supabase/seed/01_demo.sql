-- Demo company "Namuna Trading" with sample letters (optional, for showing the app).
-- Run ONCE, after 00_templates.sql. Anyone who signs up as demo@debdabe.app joins this company.

insert into public.organizations(id, name_am, name_en, address, phone, email, tin, ref_prefix, ref_pattern, plan, incoming_prefix)
values ('00000000-0000-0000-0000-0000000000d1', 'ናሙና ትሬዲንግ ኃ.የተ.የግ.ማ', 'Namuna Trading PLC (Demo)',
  'Bole Sub-City, Addis Ababa', '+251 11 000 0000', 'info@namuna-demo.et', '0000000000 (demo)', 'NT', '{PREFIX}/{SEQ3}/{ETH_YEAR}', 'office', 'IN');

insert into public.reference_counters values
  ('00000000-0000-0000-0000-0000000000d1','outgoing',2019,43),
  ('00000000-0000-0000-0000-0000000000d1','incoming',2019,14);

insert into public.signatories(id, organization_id, name_am, name_en, position_am, position_en) values
 ('00000000-0000-0000-0000-00000000a501','00000000-0000-0000-0000-0000000000d1','አቶ ሰለሞን ታደሰ','Ato Solomon Tadesse','ዋና ሥራ አስኪያጅ','General Manager'),
 ('00000000-0000-0000-0000-00000000a502','00000000-0000-0000-0000-0000000000d1','ወ/ሮ ሔለን ገብሩ','W/ro Helen Gebru','የሰው ሀብት አስተዳደር ኃላፊ','Head of Human Resources');

insert into public.contacts(organization_id, name, title, organization_name, city, type) values
 ('00000000-0000-0000-0000-0000000000d1','የኢትዮጵያ ንግድ ባንክ','ቦሌ ቅርንጫፍ','Commercial Bank of Ethiopia, Bole Branch','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','የገቢዎች ሚኒስቴር','','Ministry of Revenues','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','ናሙና አቅራቢ ኃ.የተ.የግ.ማ','','Namuna Supplier PLC (demo)','አዲስ አበባ','recipient'),
 ('00000000-0000-0000-0000-0000000000d1','ለሰው ሀብት አስተዳደር ክፍል','','','','cc'),
 ('00000000-0000-0000-0000-0000000000d1','ለፋይናንስ ክፍል','','','','cc'),
 ('00000000-0000-0000-0000-0000000000d1','ለማህደር','','','','cc');

-- sample outgoing letters

insert into public.letters(organization_id, direction, template_id, source, reference_no, sequence_no, eth_year, letter_date, subject, recipient, body, cc, signatory_id, status, finalized_at, created_at, updated_at)
select '00000000-0000-0000-0000-0000000000d1', 'outgoing', t.tid, 'template', t.ref, t.seq, 2019, (now() - (t.ago || ' days')::interval)::date, t.subj,
  t.rec::jsonb, t.body::jsonb, t.cc::jsonb, t.sig, t.st,
  case when t.st='final' then now() - (t.ago || ' days')::interval end,
  now() - (t.ago || ' days')::interval, now() - (t.ago || ' days')::interval
from (values
 ('00000000-0000-0000-0000-0000000007e2'::uuid,'NT/038/2019',38,28,'የደመወዝ ማረጋገጫ ስለመስጠት','{"name":"የኢትዮጵያ ንግድ ባንክ","title":"ቦሌ ቅርንጫፍ","city":"አዲስ አበባ"}','["አቶ አበበ ከበደ በድርጅታችን በሂሳብ ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 18,500.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለብድር አገልግሎት እንዲያገለግል የተሰጠ ነው።"]','["ለሰው ሀብት አስተዳደር ክፍል","ለማህደር"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e1'::uuid,'NT/039/2019',39,24,'የሥራ ልምድ ማረጋገጫ ስለመስጠት','{"name":"ለሚመለከተው ሁሉ","title":"","city":"አዲስ አበባ"}','["ወ/ሮ ትዕግሥት አለሙ በድርጅታችን ከመስከረም 1 ቀን 2015 ዓ.ም ጀምሮ በሽያጭ ባለሙያ የሥራ መደብ ላይ በወር ብር 12,000.00 ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።"]','["ለማህደር"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e5'::uuid,'NT/040/2019',40,20,'የዋጋ ማቅረቢያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["ድርጅታችን 20 የቢሮ ኮምፒውተሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ ጥቅምት 30 ቀን 2019 ዓ.ም ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e3'::uuid,'NT/041/2019',41,15,'የስብሰባ ጥሪ','{"name":"ለሁሉም የክፍል ኃላፊዎች","title":"","city":""}','["የ2019 ዓ.ም የመጀመሪያ ሩብ ዓመት ዕቅድ አፈጻጸም ግምገማን አስመልክቶ ጥቅምት 20 ቀን 2019 ዓ.ም 3:00 ሰዓት በዋናው መሰብሰቢያ አዳራሽ ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።"]','["ለማህደር"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e6'::uuid,'NT/042/2019',42,9,'ክፍያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["በመስከረም 15 ቀን 2019 ዓ.ም በደረሰኝ ቁጥር 00451 የተጠየቀው ብር 45,000.00 እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ ጥቅምት 28 ቀን 2019 ዓ.ም ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል","ለማህደር"]','00000000-0000-0000-0000-00000000a501'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e2'::uuid,'NT/043/2019',43,4,'የደመወዝ ማረጋገጫ ስለመስጠት','{"name":"የኢትዮጵያ ንግድ ባንክ","title":"ቦሌ ቅርንጫፍ","city":"አዲስ አበባ"}','["ወ/ሪት ሰላም ተስፋዬ በድርጅታችን በአስተዳደር ሠራተኛ የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር 14,200.00 መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለሂሳብ መክፈቻ እንዲያገለግል የተሰጠ ነው።"]','["ለሰው ሀብት አስተዳደር ክፍል"]','00000000-0000-0000-0000-00000000a502'::uuid,'final'),
 ('00000000-0000-0000-0000-0000000007e4'::uuid,null,null,2,'የዓመት ፈቃድ ስለመጠየቅ','{"name":"የሰው ሀብት አስተዳደር ክፍል","title":"","city":""}','["እኔ [ስም] በ[ክፍል] ክፍል በ[የሥራ መደብ] የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ[ቀን] እስከ [ቀን] ድረስ ለ[ቀናት] ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።"]','[]','00000000-0000-0000-0000-00000000a502'::uuid,'draft'),
 ('00000000-0000-0000-0000-0000000007e5'::uuid,null,null,1,'የዋጋ ማቅረቢያ ስለመጠየቅ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ","title":"","city":"አዲስ አበባ"}','["ድርጅታችን የቢሮ ወንበሮች ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ [ቀን] ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።"]','["ለፋይናንስ ክፍል"]','00000000-0000-0000-0000-00000000a501'::uuid,'draft')
) as t(tid, ref, seq, ago, subj, rec, body, cc, sig, st);

insert into public.letters(organization_id, direction, source, reference_no, sequence_no, eth_year, letter_date, subject, recipient, sender, their_reference, assigned_to, status, finalized_at, created_at)
values
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/012/2019',12,2019,(now()-interval '22 days')::date,'የሠራተኛ ደመወዝ ማረጋገጫ ጥያቄ','{"name":"የኢትዮጵያ ንግድ ባንክ — ቦሌ ቅርንጫፍ"}','የኢትዮጵያ ንግድ ባንክ — ቦሌ ቅርንጫፍ','CBE/BL/2231/19','ወ/ሮ ሔለን ገብሩ','final',now()-interval '22 days',now()-interval '22 days'),
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/013/2019',13,2019,(now()-interval '12 days')::date,'የ2018 ዓ.ም የግብር ማሳወቂያ ማስታወሻ','{"name":"የገቢዎች ሚኒስቴር"}','የገቢዎች ሚኒስቴር','MoR/7781/19','አቶ ሰለሞን ታደሰ','final',now()-interval '12 days',now()-interval '12 days'),
 ('00000000-0000-0000-0000-0000000000d1','incoming','incoming','IN/014/2019',14,2019,(now()-interval '3 days')::date,'የዋጋ ማቅረቢያ ምላሽ','{"name":"ናሙና አቅራቢ ኃ.የተ.የግ.ማ"}','ናሙና አቅራቢ ኃ.የተ.የግ.ማ','NS/104/19','አቶ ሰለሞን ታደሰ','final',now()-interval '3 days',now()-interval '3 days');

insert into public.letter_events(letter_id, organization_id, type, at)
select id, organization_id, 'created', created_at from public.letters where organization_id = '00000000-0000-0000-0000-0000000000d1';

insert into public.letter_events(letter_id, organization_id, type, at)
select id, organization_id, 'finalized', finalized_at from public.letters where organization_id = '00000000-0000-0000-0000-0000000000d1' and status='final' and direction='outgoing';

insert into public.invoices(organization_id, number, period_start, period_end, plan, amount, vat, total, status, paid_at) values
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '3 months','YYYYMM'), (date_trunc('month', now()) - interval '3 months')::date, (date_trunc('month', now()) - interval '2 months' - interval '1 day')::date, 'office', 1500, 225, 1725, 'paid', date_trunc('month', now()) - interval '2 months' + interval '5 days'),
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '2 months','YYYYMM'), (date_trunc('month', now()) - interval '2 months')::date, (date_trunc('month', now()) - interval '1 month' - interval '1 day')::date, 'office', 1500, 225, 1725, 'paid', date_trunc('month', now()) - interval '1 month' + interval '4 days'),
 ('00000000-0000-0000-0000-0000000000d1', 'INV-' || to_char(date_trunc('month', now()) - interval '1 month','YYYYMM'), (date_trunc('month', now()) - interval '1 month')::date, (date_trunc('month', now()) - interval '1 day')::date, 'office', 1500, 225, 1725, 'unpaid', null);
