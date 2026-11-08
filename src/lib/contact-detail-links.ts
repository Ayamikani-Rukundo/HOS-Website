export function contactDetailHref(category: string, value: string) {
  const normalizedCategory = category.trim().toLowerCase();
  const cleanValue = value.trim();
  if (!cleanValue) return null;

  if (normalizedCategory === 'email') return `mailto:${cleanValue}`;
  if (normalizedCategory === 'phone') return `tel:${cleanValue.replace(/[^\d+]/g, '')}`;
  if (normalizedCategory === 'whatsapp') {
    const digits = cleanValue.replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }
  if (['location', 'map', 'address'].includes(normalizedCategory)) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(cleanValue)}`;
  }
  if (normalizedCategory === 'website') {
    const url = /^https?:\/\//i.test(cleanValue) ? cleanValue : `https://${cleanValue}`;
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function contactDetailOpensNewTab(category: string) {
  return ['whatsapp', 'location', 'map', 'address', 'website'].includes(category.trim().toLowerCase());
}
