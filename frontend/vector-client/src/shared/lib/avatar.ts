const gradients = [
  ['#8b5cf6', '#d946ef'],
  ['#06b6d4', '#8b5cf6'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#6366f1'],
  ['#f97316', '#ec4899'],
  ['#22c55e', '#06b6d4'],
] as const;

export function getInitials(value: string): string {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return '?';
  }

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function getAvatarGradient(seed: string): string {
  const normalized = seed || 'vector';
  const hash = Array.from(normalized).reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  const [from, to] = gradients[hash % gradients.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
