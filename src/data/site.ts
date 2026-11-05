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
    'Bridging vulnerable families to the future by providing educational needs to their children and ensuring a better diet for good health.',
};

export const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Programs', href: '/programs' },
  { label: 'Projects', href: '/projects' },
  { label: 'Impact', href: '/impact' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Events', href: '/events' },
  { label: 'Donate', href: '/donate' },
  { label: 'Contact', href: '/contact' },
  { label: 'Portal', href: '/portal' },
];
