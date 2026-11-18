begin;

insert into public.team_years (year_label, active, is_published, sort_order)
select '2026-2027', true, true, 0
where not exists (
  select 1
  from public.team_years
  where regexp_replace(year_label, '[^0-9]', '', 'g') in ('20262027', '202627')
)
on conflict (year_label) do nothing;

create temporary table target_team_2026_2027 on commit drop as
select id
from public.team_years
where regexp_replace(year_label, '[^0-9]', '', 'g') in ('20262027', '202627')
order by case when year_label = '2026-2027' then 0 else 1 end, sort_order, created_at
limit 1;

create temporary table team_2026_2027_seed (
  full_name text not null,
  role_title text not null,
  focus_area text not null,
  biography text not null,
  sort_order integer not null
) on commit drop;

insert into team_2026_2027_seed (full_name, role_title, focus_area, biography, sort_order)
values
  ('Nadege SHIMWA NTWALI', 'Secretariat', 'Coordinates administrative information and communication to help the team stay organized.', 'As part of the Secretariat, Nadege helps keep HOS’s administrative work organized and information moving across the team. Through clear communication and reliable coordination, she supports colleagues as they plan and carry out activities for young people and families.', 2),
  ('Dotto DIDIER NIXON', 'HR & Administration Manager', 'Supports human resources and administration so the team can work effectively and consistently.', 'As HR and Administration Manager, Dotto supports the people and administrative processes behind HOS’s work. His role brings together staff coordination, workplace organization, and follow-through, helping the team operate consistently as it serves students, families, and communities.', 3),
  ('Benoit TETO NGABO NTWALI', 'Fundraising & Partnerships Officer', 'Builds fundraising opportunities and partnerships that help resource HOS’s mission.', 'As Fundraising and Partnerships Officer, Benoit supports HOS in building relationships and identifying resources for its mission. His work connects funding opportunities and partnership collaboration with programs for students and families, helping the organization sustain and strengthen its community support.', 4),
  ('Naomi KAELA HABIMANA', 'Fundraising & Partnership Officer', 'Develops supporter and partnership relationships to strengthen resources for HOS programs.', 'As Fundraising and Partnership Officer, Naomi helps cultivate supporters and partnership opportunities that can contribute to HOS’s work. Her role centers on communicating the organization’s mission, developing constructive relationships, and helping connect resources with programs serving young people and families.', 5),
  ('Joyeuse UWAMAHIRWE', 'Programs & Community Outreach Coordinator', 'Coordinates programs and outreach so community needs can inform HOS activities and support.', 'As Programs and Community Outreach Coordinator, Joyeuse helps connect HOS activities with the people and communities they are intended to serve. Her role brings program coordination together with community engagement, supporting thoughtful planning and clear communication around the organization’s work.', 6),
  ('Ines IRADUKUNDA', 'Community Outreach Coordinator', 'Builds community connections and helps link people with relevant HOS activities and support.', 'As Community Outreach Coordinator, Ines helps strengthen HOS’s relationships with the community. Through respectful communication and consistent engagement, she supports connections between the organization, families, and local needs, helping outreach remain welcoming and responsive.', 7),
  ('Tresor RWOGERE', 'Social Welfare & Child Protection Officer', 'Supports social welfare and child protection with a focus on safety, dignity, and wellbeing.', 'As Social Welfare and Child Protection Officer, Tresor contributes to work that places children’s safety and wellbeing at the center. His role supports compassionate attention to social needs and helps ensure that children and families are treated with dignity when seeking assistance.', 8),
  ('Babra SINGANA', 'Social Welfare & Child Protection Officer', 'Promotes child safety and connects social welfare needs with appropriate care and support.', 'As Social Welfare and Child Protection Officer, Babra supports a caring, protective approach to HOS’s work with children and families. Her role focuses on wellbeing, respectful support, and helping social welfare needs receive thoughtful attention within the organization’s activities.', 9),
  ('Uwase SHIFFA', 'Campaigns, Events and Advocacy Coordinator', 'Coordinates campaigns, events, and advocacy that engage people with HOS’s mission.', 'As Campaigns, Events and Advocacy Coordinator, Uwase helps create opportunities for people to learn about and take part in HOS’s mission. Her work brings campaign planning, event coordination, and advocacy together to encourage community engagement and support for young people and families.', 10),
  ('Kelvin IZIBYOSE', 'Events & Campaigns Coordinator', 'Plans events and campaigns that connect supporters with HOS activities and priorities.', 'As Events and Campaigns Coordinator, Kelvin helps organize initiatives that bring people together around HOS’s work. His role supports clear planning and coordination so campaigns and events can communicate the organization’s priorities and invite meaningful community participation.', 11),
  ('Keza PRAISE', 'Communications, PR & Digital Media Officer', 'Shares HOS’s work through communications, public relations, and digital media.', 'As Communications, PR and Digital Media Officer, Keza helps present HOS’s mission and activities to the public. Her role brings together clear communication, relationship-building, and digital storytelling to help audiences understand the organization’s work and the communities it serves.', 12),
  ('Bonheur MUTUYIMANA', 'Social Media Manager & Advisor', 'Guides social media communication and advises on how HOS presents its work online.', 'As Social Media Manager and Advisor, Bonheur supports HOS’s online communication and offers guidance on its social media presence. His role helps keep messages clear and connected to the organization’s mission, while making its activities more accessible to supporters and the wider community.', 13),
  ('Bonheur DUFITIMANA', 'Programs & Community Outreach Coordinator', 'Coordinates programs and community outreach to help HOS respond to local needs.', 'As Programs and Community Outreach Coordinator, Bonheur helps connect HOS programs with community relationships and needs. His role supports coordination between planned activities and the people they are designed to reach, helping the organization maintain responsive engagement with students and families.', 14);

with target_year as (
  select id
  from target_team_2026_2027
)
update public.team_members as member
set role_title = seed.role_title,
    focus_area = seed.focus_area,
    biography = seed.biography,
    sort_order = seed.sort_order,
    is_published = true,
    status = 'active'
from team_2026_2027_seed as seed
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
from team_2026_2027_seed as seed
cross join (
  select id
  from target_team_2026_2027
) as target_year
where not exists (
  select 1
  from public.team_members as existing
  where existing.team_year_id = target_year.id
    and lower(trim(existing.full_name)) = lower(trim(seed.full_name))
);

commit;
