/**
 * Format a number as Philippine Peso.
 * formatPHP(1250)    → "₱1,250.00"
 * formatPHP(85.5)    → "₱85.50"
 * formatPHP("175")   → "₱175.00"
 */
export function formatPHP(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num == null || isNaN(num)) return "₱0.00";
  return `₱${num.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
