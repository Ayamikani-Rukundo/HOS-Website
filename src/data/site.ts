export type NavItem = {
  label: string;
  href: string;
};

export const siteConfig = {
  name: 'Heart of Sympathy',
  tagline: 'Bridge Them To The Future',
  location: 'Kigali, Rwanda',
  founded: '2023',
  mission:
    'Heart of Sympathy supports students and families in Kigali through education, nutrition, health, mentorship, and practical family assistance.',
};

export const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Our children', href: '/students' },
  { label: 'Programs', href: '/programs' },
  { label: 'Partners', href: '/partners' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Events', href: '/events' },
  { label: 'Donate', href: '/donate' },
  { label: 'Contact', href: '/contact' },
  { label: 'Portal', href: '/portal' },
];
