-- The 6 built-in letter templates (shared by every organisation, read-only for them).
-- The ids are fixed: the AI model maps each letter type to one of these ids.
-- Safe to re-run: it updates the templates in place.

insert into public.templates(id, organization_id, title_am, title_en, category, subject_am, body_am, fields) values
('00000000-0000-0000-0000-0000000007e1', null, 'የሥራ ልምድ ማረጋገጫ', 'Work experience confirmation', 'HR', 'የሥራ ልምድ ማረጋገጫ ስለመስጠት',
 '{{title}} {{employee_name}} በድርጅታችን ከ{{start_date}} ጀምሮ በ{{position}} የሥራ መደብ ላይ በወር ብር {{salary}} ደመወዝ እየተከፈላቸው በማገልገል ላይ መሆናቸውን እየገለጽን፣ ይህ የሥራ ልምድ ማረጋገጫ በጠየቁት መሠረት የተሰጠ መሆኑን እናሳውቃለን።',
 '[{"key":"title","label_am":"መጠሪያ (አቶ/ወ/ሮ/ወ/ሪት)","label_en":"Title","type":"text","required":true},{"key":"employee_name","label_am":"የሠራተኛ ስም","label_en":"Employee name","type":"text","required":true},{"key":"start_date","label_am":"የተቀጠሩበት ቀን","label_en":"Start date","type":"date","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"salary","label_am":"ደመወዝ","label_en":"Salary","type":"money","required":true}]'),
('00000000-0000-0000-0000-0000000007e2', null, 'የደመወዝ ማረጋገጫ', 'Salary confirmation (for a bank)', 'HR / Banking', 'የደመወዝ ማረጋገጫ ስለመስጠት',
 '{{title}} {{employee_name}} በድርጅታችን በ{{position}} የሥራ መደብ ላይ ተቀጥረው የሚሠሩ ሲሆን ወርሃዊ ጠቅላላ ደመወዛቸው ብር {{gross_salary}} መሆኑን እናረጋግጣለን። ይህ ማረጋገጫ ለ{{purpose}} እንዲያገለግል የተሰጠ ነው።',
 '[{"key":"title","label_am":"መጠሪያ","label_en":"Title","type":"text","required":true},{"key":"employee_name","label_am":"የሠራተኛ ስም","label_en":"Employee name","type":"text","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"gross_salary","label_am":"ጠቅላላ ደመወዝ","label_en":"Gross salary","type":"money","required":true},{"key":"purpose","label_am":"ዓላማ","label_en":"Purpose","type":"text","required":true}]'),
('00000000-0000-0000-0000-0000000007e3', null, 'የስብሰባ ጥሪ', 'Meeting invitation', 'Administration', 'የስብሰባ ጥሪ',
 '{{meeting_topic}}ን አስመልክቶ {{meeting_date}} {{meeting_time}} ሰዓት በ{{venue}} ስብሰባ ስለሚካሄድ፣ በስብሰባው ላይ እንድትገኙልን በአክብሮት እንጠይቃለን።',
 '[{"key":"meeting_topic","label_am":"የስብሰባው ርዕስ","label_en":"Meeting topic","type":"text","required":true},{"key":"meeting_date","label_am":"ቀን","label_en":"Date","type":"date","required":true},{"key":"meeting_time","label_am":"ሰዓት","label_en":"Time","type":"text","required":true},{"key":"venue","label_am":"ቦታ","label_en":"Venue","type":"text","required":true}]'),
('00000000-0000-0000-0000-0000000007e4', null, 'የዓመት ፈቃድ ጥያቄ', 'Annual leave request', 'HR', 'የዓመት ፈቃድ ስለመጠየቅ',
 'እኔ {{employee_name}} በ{{department}} ክፍል በ{{position}} የሥራ መደብ ላይ የምሠራ ሲሆን፣ ከ{{from_date}} እስከ {{to_date}} ድረስ ለ{{days}} ቀናት የዓመት ፈቃዴን እንድወስድ እንዲፈቀድልኝ በአክብሮት እጠይቃለሁ።',
 '[{"key":"employee_name","label_am":"ስም","label_en":"Employee name","type":"text","required":true},{"key":"department","label_am":"ክፍል","label_en":"Department","type":"text","required":true},{"key":"position","label_am":"የሥራ መደብ","label_en":"Position","type":"text","required":true},{"key":"from_date","label_am":"ከ","label_en":"From","type":"date","required":true},{"key":"to_date","label_am":"እስከ","label_en":"To","type":"date","required":true},{"key":"days","label_am":"የቀናት ብዛት","label_en":"Days","type":"number","required":true}]'),
('00000000-0000-0000-0000-0000000007e5', null, 'የዋጋ ማቅረቢያ ጥያቄ', 'Request for quotation', 'Procurement', 'የዋጋ ማቅረቢያ ስለመጠየቅ',
 'ድርጅታችን {{items}} ለመግዛት ስለሚፈልግ፣ ቫትን ጨምሮ የዋጋ ማቅረቢያችሁን እስከ {{deadline}} ድረስ እንድታቀርቡልን በአክብሮት እንጠይቃለን።',
 '[{"key":"items","label_am":"የሚገዙ እቃዎች","label_en":"Items","type":"text","required":true},{"key":"deadline","label_am":"የመጨረሻ ቀን","label_en":"Deadline","type":"date","required":true}]'),
('00000000-0000-0000-0000-0000000007e6', null, 'የክፍያ ጥያቄ', 'Payment request', 'Finance', 'ክፍያ ስለመጠየቅ',
 'በ{{invoice_date}} በደረሰኝ ቁጥር {{invoice_number}} የተጠየቀው ብር {{amount}} እስካሁን ያልተከፈለ በመሆኑ፣ ክፍያውን እስከ {{due_date}} ድረስ እንድትፈጽሙልን በአክብሮት እንጠይቃለን።',
 '[{"key":"invoice_date","label_am":"የደረሰኝ ቀን","label_en":"Invoice date","type":"date","required":true},{"key":"invoice_number","label_am":"የደረሰኝ ቁጥር","label_en":"Invoice number","type":"text","required":true},{"key":"amount","label_am":"መጠን","label_en":"Amount","type":"money","required":true},{"key":"due_date","label_am":"የክፍያ ቀን","label_en":"Due date","type":"date","required":true}]')
on conflict (id) do update set
  title_am = excluded.title_am, title_en = excluded.title_en, category = excluded.category,
  subject_am = excluded.subject_am, body_am = excluded.body_am, fields = excluded.fields;
