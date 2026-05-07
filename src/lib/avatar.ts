export function getAvatarUrl(user?: { avatar?: string; email?: string } | null) {
  const avatar = String(user?.avatar || '').trim();
  if (avatar) return avatar;
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email || 'delivoo')}`;
}

export function fallbackAvatarUrl(email?: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email || 'delivoo')}`;
}

