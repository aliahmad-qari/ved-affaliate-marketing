export function maskPublicPartnerName(value: unknown): string {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'VED Partner';
  return words.map((word, index) => {
    if (index > 0) return `${word.slice(0, Math.min(3, word.length))}**`;
    return word.length <= 2 ? `${word[0]}**` : `${word[0]}**${word.at(-1)}`;
  }).join(' ');
}

export function maskPublicPartnerId(value: unknown): string {
  const id = String(value || '').trim();
  if (!id) return 'VED**';
  return `${id.slice(0, Math.max(1, id.length - 2))}**`;
}
