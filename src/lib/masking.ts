// Mask PAN: e.g. ABCDE1234F -> ABCDE****F
export function maskPan(pan: string): string {
  if (!pan || pan.length < 10) return '**********';
  return `${pan.substring(0, 5)}****${pan.substring(9)}`;
}

// Mask Bank Account: e.g. 123456789012 -> ********9012
export function maskAccountNumber(acc: string): string {
  if (!acc || acc.length < 4) return '****';
  const visible = acc.slice(-4);
  return `${'*'.repeat(Math.max(4, acc.length - 4))}${visible}`;
}
