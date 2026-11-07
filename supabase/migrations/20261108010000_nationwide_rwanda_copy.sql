begin;

update public.organizations
set location = 'Rwanda',
    mission = 'Heart of Sympathy supports students and families across Rwanda, with a strong impact in Kigali, through education, nutrition, health, mentorship, and practical family assistance.'
where location = 'Kigali, Rwanda'
   or mission = 'Heart of Sympathy supports students and families in Kigali through education, nutrition, health, mentorship, and practical family assistance.';

update public.website_sections
set title = 'Student support across Rwanda, beyond the classroom.',
    content = jsonb_set(
      content,
      '{eyebrow}',
      to_jsonb('Youth-led student and family support across Rwanda, with a strong impact in Kigali'::text),
      true
    )
where section_key = 'home_hero'
  and (
    title = 'Student support in Kigali, beyond the classroom.'
    or content ->> 'eyebrow' = 'Youth-led student and family support in Kigali'
  );

update public.website_sections
set content = jsonb_set(
  content,
  '{intro}',
  to_jsonb('Founded in 2023, Heart of Sympathy is a youth-led nonprofit supporting students and families across Rwanda, with a strong impact in Kigali, through education, nutrition, health, mentorship, and practical assistance.'::text),
  true
)
where section_key = 'about'
  and content ->> 'intro' = 'Founded in 2023 in Kigali, Heart of Sympathy is a youth-led nonprofit that supports students and their families through education, nutrition, health, mentorship, and practical assistance.';

commit;
