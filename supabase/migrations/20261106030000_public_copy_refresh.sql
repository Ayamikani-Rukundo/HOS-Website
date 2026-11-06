begin;

update public.organizations
set mission = 'Heart of Sympathy supports students and families in Kigali through education, nutrition, health, mentorship, and practical family assistance.'
where mission = 'Bridging vulnerable families to the future by providing educational needs to their children and ensuring a better diet for good health.';

update public.programs as programs
set summary = content.new_summary,
    impact = content.new_focus
from (values
  (
    'education-sponsorship',
    'Educational support for children in vulnerable families, including the needs that help learners stay engaged in school.',
    'Extending access to quality education.',
    'Education support for students from vulnerable families, including needs that help them stay engaged in school.',
    'School-related support for participating students.'
  ),
  (
    'nutrition-health',
    'Nutrition and health support, including balanced diets and healthcare assistance for vulnerable people.',
    'Supporting better health and wellbeing.',
    'Nutrition and healthcare assistance for students and families.',
    'Nutrition and healthcare assistance.'
  ),
  (
    'family-support',
    'Practical support for vulnerable families, including clothing, household sanitation materials, and emergency assistance.',
    'Strengthening family stability and dignity.',
    'Practical support for families of participating students, including clothing, sanitation materials, and emergency assistance.',
    'Practical household and emergency assistance.'
  ),
  (
    'mentorship',
    'Social mentorship and community support that help children and families build stability and opportunity.',
    'Building confidence and stronger communities.',
    'Mentorship and community support for students and their families.',
    'Mentorship for students and families.'
  )
) as content(slug, old_summary, old_focus, new_summary, new_focus)
where programs.slug = content.slug
  and programs.summary = content.old_summary
  and programs.impact = content.old_focus;

update public.campaign_categories
set description = 'Unrestricted contributions toward HOS student and family support.'
where name = 'General Mission'
  and description = 'Flexible support for the organization’s mission.';

update public.website_sections
set title = 'Student support in Kigali, beyond the classroom.',
    content = jsonb_set(
      jsonb_set(
        jsonb_set(
          content,
          '{eyebrow}',
          to_jsonb('Youth-led student and family support in Kigali'::text),
          true
        ),
        '{description}',
        to_jsonb('Heart of Sympathy supports students and families through education, nutrition, health, mentorship, and practical assistance.'::text),
        true
      ),
      '{support_note}',
      to_jsonb('Our team follows student support needs across school, health, and family life.'::text),
      true
    )
where section_key = 'home_hero'
  and title = 'Building futures with dignity, care, and opportunity.'
  and content ->> 'description' = 'We support children and families beyond school fees, combining education, nutrition, health, and community care to help communities thrive.';

update public.website_sections
set content = jsonb_set(
  content,
  '{intro}',
  to_jsonb('Founded in 2023 in Kigali, Heart of Sympathy is a youth-led nonprofit that supports students and their families through education, nutrition, health, mentorship, and practical assistance.'::text),
  true
)
where section_key = 'about'
  and content ->> 'intro' = 'Founded in 2023 in Kigali, Heart of Sympathy was built around a simple conviction: real support for vulnerable children means caring for the whole family system.';

update public.website_sections
set content = jsonb_set(
  content,
  '{vision}',
  '[
    "Help students continue their education.",
    "Address nutrition and health needs alongside school support.",
    "Include families through mentorship and practical assistance."
  ]'::jsonb,
  true
)
where section_key = 'about'
  and content -> 'vision' = '[
    "Extending quality education to as many vulnerable children as possible.",
    "Providing balanced diets to the ill in public hospitals.",
    "Providing income-generating activities to vulnerable families."
  ]'::jsonb;

update public.website_sections
set title = 'Student and family support programs.',
    content = jsonb_set(
      content,
      '{intro}',
      to_jsonb('HOS supports students through education, nutrition, health, mentorship, and practical assistance for families.'::text),
      true
    )
where section_key = 'programs'
  and title = 'Care that reaches the whole family.'
  and content ->> 'intro' = 'Our programs respond to the connected education, nutrition, health, and household needs of vulnerable families.';

update public.website_sections
set title = 'Support a current HOS priority.',
    content = jsonb_set(
      content,
      '{intro}',
      to_jsonb('View current campaigns and contact Heart of Sympathy for verified giving instructions. Payments are not processed on this website.'::text),
      true
    )
where section_key = 'donate'
  and title = 'Create steady support for children and families.'
  and content ->> 'intro' = 'Choose from current published campaigns or contact the organization to learn about other ways to help.';

update public.website_sections
set title = 'Contact Heart of Sympathy.',
    content = jsonb_set(
      content,
      '{intro}',
      to_jsonb('Send a message about student support, partnerships, volunteering, or another HOS matter.'::text),
      true
    )
where section_key = 'contact'
  and title = 'Let’s work together.'
  and content ->> 'intro' = 'Contact Heart of Sympathy to learn about programs, partnerships, or volunteering.';

delete from public.website_sections
where section_key = 'impact'
  and title = 'Real outcomes for children and families.'
  and content ->> 'intro' = 'Impact measures and community stories are published only after they have been verified and approved.';

commit;
