begin;

insert into public.team_years (year_label, active, is_published, sort_order)
values ('2025-2026', true, true, -1)
on conflict (year_label) do update
set active = true,
    is_published = true;

create temporary table team_2025_2026_seed (
  full_name text not null,
  role_title text not null,
  focus_area text not null,
  biography text not null,
  sort_order integer not null
) on commit drop;

insert into team_2025_2026_seed (full_name, role_title, focus_area, biography, sort_order)
values
  ('Manasse NIYITANGA', 'Founder & CEO', 'Leads HOS’s mission and strategic direction, championing mentorship, faith, character, and education for young people.', 'Guided by a heart for mentorship, Manasse founded Heart of Sympathy to encourage young people to grow in faith, character, and education. As Founder and CEO, he provides leadership for the organization’s mission and helps keep its work centered on creating hope and opportunity for the youth it serves.', 1),
  ('Sarah UMUTONI', 'Cofounder & Advisor', 'Advises the organization and supports mentorship that helps young people grow in faith, character, and education.', 'Guided by a heart for mentorship, Sarah co-founded Heart of Sympathy to encourage young people to grow in faith, character, and education. As cofounder and advisor, she offers guidance in support of the organization’s mission and its commitment to helping young people build a hopeful future.', 2),
  ('Anita ISINGIZWE', 'Managing Director', 'Guides organizational management and keeps programs aligned with HOS’s mission and community needs.', 'As Managing Director, Anita helps guide HOS’s work and keep its mission focused on serving people facing hardship. Isaiah 58:10 calls us to share with the hungry and care for those in distress, reflecting the compassion and practical service at the heart of her work.', 3),
  ('Salim TUYIZERE', 'Deputy Director & Social Media Assistant', 'Supports leadership and leads social media communication to share HOS’s work and impact.', 'As Deputy Director and Social Media Assistant, Salim supports HOS’s leadership and helps share its work with the community. Matthew 5:16 calls people to let their light shine through good works; this message reflects his role in communicating the organization’s service and encouraging others to see the good it does.', 4),
  ('Joel Don NIYONCUTI', 'Operations Manager', 'Coordinates day-to-day operations so HOS can provide reliable support to students and families.', 'As Operations Manager, Joel helps coordinate the work that enables HOS to serve students and families. Proverbs 19:17 teaches that caring for people in poverty is an act of kindness valued by God; it reflects the compassion and responsibility that guide his contribution to the organization.', 5),
  ('INEZA Cinta Castella', 'IT & Data System Officer', 'Maintains IT and data systems that support accurate information and effective organizational work.', 'As IT and Data System Officer, Cinta supports the systems and information that help HOS carry out its work. Proverbs 22:9 praises generosity toward people in need, a reminder that practical skills and thoughtful service can help strengthen care for the community.', 6),
  ('NAMAHORO Leon Christian', 'Assistant IT', 'Provides IT support and helps maintain the digital tools used by the HOS team.', 'As Assistant IT, Leon contributes technical support to HOS’s day-to-day work. “We love because he first loved us” (1 John 4:19) is a reminder that service begins with love; he brings that spirit to supporting the people and systems behind the organization’s mission.', 7),
  ('UMUHOZA Queen', 'Fundraising & Grant Writing Officer', 'Develops funding opportunities and grant proposals to resource HOS programs and community initiatives.', 'As Fundraising and Grant Writing Officer, Queen helps communicate HOS’s mission and seek resources for its work. James 1:27 describes care for orphans and widows as an expression of sincere faith, reflecting the compassion that motivates support for children and families facing hardship.', 8),
  ('Providence ABIZERA', 'Accountant & Public Relations Officer', 'Oversees accounting and helps communicate HOS’s work to partners and the public.', 'As Accountant and Public Relations Officer, Providence supports responsible financial work and clear communication about HOS’s mission. Psalm 41:1 speaks of blessing those who consider the poor; it reflects the care and accountability that should accompany efforts to support people in need.', 9),
  ('KIREZI Audrey', 'Human Resource Manager', 'Supports human resources and helps build a capable, organized, and people-centered team.', 'As Human Resource Manager, Audrey supports the people who contribute to HOS’s mission. Luke 3:11 calls those with extra clothing or food to share with people who have none, reflecting a spirit of fairness, generosity, and practical care in service to others.', 10),
  ('MUNEZERO Deborah', 'Finance Manager', 'Manages financial planning, records, and stewardship in support of HOS programs.', 'As Finance Manager, Deborah helps oversee the financial work that supports HOS’s programs and services. Galatians 6:10 encourages doing good whenever there is an opportunity, a principle that connects careful stewardship with the organization’s commitment to serve its community.', 11),
  ('Michaella ISARO', 'Secretary', 'Supports administrative coordination, records, and communication across the organization.', 'As Secretary, Michaella helps support HOS’s coordination and communication. Galatians 6:10 encourages people to do good whenever they have the opportunity; this message reflects the kindness and reliability that help an organization serve its community well.', 12),
  ('UWONKUNDA Pacifique', 'Child Protection Officer', 'Promotes child safety, wellbeing, and protection in HOS-supported activities and services.', 'As Child Protection Officer, Pacifique helps keep children’s wellbeing and safety central to HOS’s work. Hebrews 13:16 teaches not to forget doing good and sharing with others, reflecting the care and responsibility involved in protecting and supporting children.', 13),
  ('Marceline NIYIGENA', 'Education Support Officer', 'Supports students’ learning and connects educational needs with practical assistance.', 'As Education Support Officer, Marceline contributes to HOS’s support for students and their learning. Luke 6:38 speaks of giving generously, a reminder that encouragement and practical support can help young people continue their education and pursue a brighter future.', 14),
  ('Derick MUGISHA', 'Communication Officer', 'Communicates HOS’s mission, activities, and community impact to relevant audiences.', 'As Communication Officer, Derick helps share HOS’s work and its commitment to the community. James 1:27 connects sincere faith with caring for orphans and widows in hardship; this message reflects the people-centered purpose behind the organization’s communication.', 15),
  ('IRANEJEJE Fabrice', 'Event & Campaigns Coordinator', 'Coordinates events and campaigns that engage supporters and advance HOS’s mission.', 'As Event and Campaigns Coordinator, Fabrice helps organize opportunities for people to connect with and support HOS’s mission. Acts 20:35 reminds us that giving brings blessing, reflecting the generosity and shared effort that make community initiatives possible.', 16),
  ('SANA Ketia', 'Community Outreach Coordinator', 'Builds community relationships and connects families with appropriate HOS support.', 'As Community Outreach Coordinator, Ketia helps connect HOS with the people and families it serves. Ephesians 4:32 calls us to kindness, compassion, and forgiveness; those values guide respectful relationships and caring support within the community.', 17),
  ('Ian NKURUNZIZA', 'Community Outreach Coordinator', 'Strengthens community relationships and coordinates outreach to students and families.', 'As Community Outreach Coordinator, Ian helps build connections between HOS and its community. Romans 12:10 encourages people to show affection and honor one another, reflecting the respect and care that are essential to meaningful outreach.', 18);

with target_year as (
  select id
  from public.team_years
  where year_label = '2025-2026'
)
update public.team_members as member
set role_title = seed.role_title,
    focus_area = seed.focus_area,
    biography = seed.biography,
    sort_order = seed.sort_order,
    is_published = true,
    status = 'active'
from team_2025_2026_seed as seed
cross join target_year
where member.team_year_id = target_year.id
  and lower(trim(member.full_name)) = lower(trim(seed.full_name));

insert into public.team_members (
  team_year_id,
  full_name,
  role_title,
  focus_area,
  biography,
  sort_order,
  is_published,
  status
)
select
  target_year.id,
  seed.full_name,
  seed.role_title,
  seed.focus_area,
  seed.biography,
  seed.sort_order,
  true,
  'active'
from team_2025_2026_seed as seed
cross join (
  select id
  from public.team_years
  where year_label = '2025-2026'
) as target_year
where not exists (
  select 1
  from public.team_members as existing
  where existing.team_year_id = target_year.id
    and lower(trim(existing.full_name)) = lower(trim(seed.full_name))
);

update public.team_members as member
set role_title = seed.role_title,
    focus_area = seed.focus_area,
    biography = seed.biography,
    is_published = true,
    status = 'active'
from team_2025_2026_seed as seed
where seed.full_name in ('Manasse NIYITANGA', 'Sarah UMUTONI')
  and lower(trim(member.full_name)) = lower(trim(seed.full_name));

insert into public.team_members (
  team_year_id,
  full_name,
  role_title,
  focus_area,
  biography,
  sort_order,
  is_published,
  status
)
select
  years.id,
  seed.full_name,
  seed.role_title,
  seed.focus_area,
  seed.biography,
  coalesce((
    select max(existing.sort_order) + 1
    from public.team_members as existing
    where existing.team_year_id = years.id
  ), 0) + case when seed.full_name = 'Sarah UMUTONI' then 1 else 0 end,
  true,
  'active'
from public.team_years as years
cross join team_2025_2026_seed as seed
where seed.full_name in ('Manasse NIYITANGA', 'Sarah UMUTONI')
  and not exists (
    select 1
    from public.team_members as existing
    where existing.team_year_id = years.id
      and lower(trim(existing.full_name)) = lower(trim(seed.full_name))
  );

commit;
