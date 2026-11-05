export type OrganizationRole =
  | 'admin'
  | 'director'
  | 'management'
  | 'it_data'
  | 'communications'
  | 'secretariat'
  | 'program_manager'
  | 'case_worker'
  | 'child_protection'
  | 'education_support'
  | 'health_nutrition'
  | 'finance'
  | 'fundraiser'
  | 'volunteer_manager'
  | 'hr'
  | 'staff';

export type PortalKind = 'content' | 'secretariat' | 'programs' | 'finance' | 'fundraising';

export const rolePortals: Record<OrganizationRole, PortalKind[]> = {
  admin: ['content'],
  director: [],
  management: [],
  it_data: [],
  communications: ['content'],
  secretariat: ['secretariat'],
  program_manager: ['programs'],
  case_worker: ['programs'],
  child_protection: ['programs'],
  education_support: ['programs'],
  health_nutrition: ['programs'],
  finance: ['finance'],
  fundraiser: ['fundraising'],
  volunteer_manager: ['secretariat'],
  hr: ['secretariat'],
  staff: [],
};

export const portalDetails: Record<PortalKind, { label: string; description: string }> = {
  content: {
    label: 'Administration',
    description: 'Leadership oversight, organization administration and public communications.',
  },
  secretariat: {
    label: 'Secretariat',
    description: 'Manage meeting records, staff updates and volunteer coordination assigned to your role.',
  },
  programs: {
    label: 'Programs / Child Support',
    description: 'Manage program delivery or assigned confidential casework.',
  },
  finance: {
    label: 'Finance',
    description: 'Maintain verified donation records.',
  },
  fundraising: {
    label: 'Fundraising / Grants',
    description: 'Manage giving campaigns, donor relationships and grant opportunities.',
  },
};

export const portalTeams: Partial<Record<OrganizationRole, { label: string; members: string[] }>> = {
  admin: {
    label: 'Administration team',
    members: ['Ayamikani Rukundo Emmanuel', 'Tuyizer Salim'],
  },
  communications: {
    label: 'Communications team',
    members: ['KEZA Praise', 'Ayamikani Rukundo Emmanuel', 'Tuyizer Salim'],
  },
  secretariat: {
    label: 'Secretariat team',
    members: ['DOTTO DIDIER Nixon', 'Nadege Shima Ntwari'],
  },
  volunteer_manager: {
    label: 'Volunteer management team',
    members: ['Ines Iradukunda', 'Bonheur DUFITIMANA', 'Amahirwe Joyeuse'],
  },
  finance: {
    label: 'Finance team',
    members: ['FORGIVENESS Peace Love'],
  },
  program_manager: {
    label: 'Programs / Child Support team',
    members: ['Tesor RWOGERE', 'Babra Singana', 'Uwunkunda Pacifique', 'Isaro Michaella'],
  },
  case_worker: {
    label: 'Case workers',
    members: ['Tesor RWOGERE', 'Babra Singana', 'Uwunkunda Pacifique', 'Isaro Michaella'],
  },
  fundraiser: {
    label: 'Fundraising / Grants team',
    members: ['Benoit Ntwali Ngabo Teto', 'Habimana Kaela Naomi', 'Isingizwe Anita', 'Queen Merveille', 'Niyonsuti Don Joel'],
  },
};

const portalTeamRoles: Record<PortalKind, OrganizationRole[]> = {
  content: ['admin', 'communications'],
  secretariat: ['secretariat', 'volunteer_manager'],
  programs: ['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'],
  finance: ['finance'],
  fundraising: ['fundraiser'],
};

export function getPortalTeam(portal: PortalKind, roles: string[]) {
  const teamRole = portalTeamRoles[portal].find((role) => roles.includes(role));
  return teamRole ? portalTeams[teamRole] : undefined;
}

export function getPortals(roles: string[]) {
  const portals = new Set<PortalKind>();
  for (const role of roles) {
    if (role in rolePortals) {
      for (const portal of rolePortals[role as OrganizationRole]) portals.add(portal);
    }
  }
  return [...portals];
}

export function canAccessRole(roles: string[], allowed: OrganizationRole[]) {
  return roles.some((role) => allowed.includes(role as OrganizationRole));
}
