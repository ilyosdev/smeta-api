export function formatMoney(amount: number): string {
  if (amount >= 1_000_000_000) {
    const mlrd = amount / 1_000_000_000;
    return `${mlrd.toFixed(mlrd % 1 === 0 ? 0 : 2)} mlrd`;
  }
  if (amount >= 1_000_000) {
    const mln = amount / 1_000_000;
    return `${mln.toFixed(mln % 1 === 0 ? 0 : 1)} mln`;
  }
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

export function formatMoneyFull(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function profitLossEmoji(amount: number): string {
  if (amount > 0) return '📈';
  if (amount < 0) return '📉';
  return '➖';
}

/**
 * Parse a number from user input, stripping commas, spaces, underscores.
 * Returns NaN if not a valid number.
 */
export function parseNumber(text: string): number {
  const cleaned = text.replace(/[\s,_]/g, '');
  if (cleaned.length === 0) return NaN;
  return Number(cleaned);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
