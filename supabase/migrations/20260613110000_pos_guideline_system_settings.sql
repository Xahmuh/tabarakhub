alter table public.system_settings
  add column if not exists pos_guideline_enabled boolean not null default true,
  add column if not exists pos_guideline_title text not null default 'Attention / تنبيه',
  add column if not exists pos_guideline_intro text not null default 'Choose the correct type before submitting to keep reports accurate.',
  add column if not exists pos_guideline_lost_sales_en text not null default 'Actual customer request + item unavailable in branch.',
  add column if not exists pos_guideline_shortage_en text not null default 'Daily missing stock, even without a customer request.',
  add column if not exists pos_guideline_lost_sales_ar text not null default 'طلب فعلي من عميل + الصنف غير متوفر داخل الفرع.',
  add column if not exists pos_guideline_shortage_ar text not null default 'نواقص يومية داخل الفرع حتى بدون طلب من عميل.';

update public.system_settings
set
  pos_guideline_enabled = coalesce(pos_guideline_enabled, true),
  pos_guideline_title = coalesce(nullif(pos_guideline_title, ''), 'Attention / تنبيه'),
  pos_guideline_intro = coalesce(nullif(pos_guideline_intro, ''), 'Choose the correct type before submitting to keep reports accurate.'),
  pos_guideline_lost_sales_en = coalesce(nullif(pos_guideline_lost_sales_en, ''), 'Actual customer request + item unavailable in branch.'),
  pos_guideline_shortage_en = coalesce(nullif(pos_guideline_shortage_en, ''), 'Daily missing stock, even without a customer request.'),
  pos_guideline_lost_sales_ar = coalesce(nullif(pos_guideline_lost_sales_ar, ''), 'طلب فعلي من عميل + الصنف غير متوفر داخل الفرع.'),
  pos_guideline_shortage_ar = coalesce(nullif(pos_guideline_shortage_ar, ''), 'نواقص يومية داخل الفرع حتى بدون طلب من عميل.')
where id = 'global';

notify pgrst, 'reload schema';
