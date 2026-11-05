import { writeFileSync } from 'node:fs';

const filename = process.argv[2] ?? 'staff-accounts.csv';
const template = [
  'portal,account_email,role,team_members,password',
  'Administration,admin@hos.org,admin,"Ayamikani Rukundo Emmanuel; Tuyizer Salim",',
  'Communications,communications@hos.org,communications,"KEZA Praise; Ayamikani Rukundo Emmanuel; Tuyizer Salim",',
  'Secretariat,secretariat@hos.org,secretariat,"DOTTO DIDIER Nixon; Nadege Shima Ntwari",',
  'Volunteer Management,volunteers@hos.org,volunteer_manager,"Ines Iradukunda; Bonheur DUFITIMANA; Amahirwe Joyeuse",',
  'Finance,finance@hos.org,finance,FORGIVENESS Peace Love,',
  'Programs / Child Support,programs@hos.org,program_manager,"Tesor RWOGERE; Babra Singana; Uwunkunda Pacifique; Isaro Michaella",',
  'Case Worker,caseworker@hos.org,case_worker,"Tesor RWOGERE; Babra Singana; Uwunkunda Pacifique; Isaro Michaella",',
  'Fundraising / Grants,fundraising@hos.org,fundraiser,"Benoit Ntwali Ngabo Teto; Habimana Kaela Naomi; Isingizwe Anita; Queen Merveille; Niyonsuti Don Joel",',
  '',
].join('\n');
writeFileSync(filename, template, { encoding: 'utf8', flag: 'wx' });
console.log(`Created ${filename}. Enter one chosen password for each shared portal account, then run npm run provision:staff.`);
