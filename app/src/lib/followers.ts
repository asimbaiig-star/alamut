// followers.ts — a follower count the way the portal prints it (48K, 1.2M).
// No imports: the landing bundle reads this file.

export function fmtFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return n.toString();
}
