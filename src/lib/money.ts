export function formatKRW(value: number): string {
  const rounded = Math.round(value);
  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded).toLocaleString("ko-KR")}원`;
}

export function formatSignedKRW(value: number): string {
  if (value === 0) return "0원";
  return `${value > 0 ? "+" : "−"}${Math.abs(Math.round(value)).toLocaleString("ko-KR")}원`;
}

/** 1,234,567 → "123만", 152,000,000 → "1.5억" (for chart axes and tight spaces) */
export function formatCompactKRW(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e8) return `${sign}${trimZero((abs / 1e8).toFixed(1))}억`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString("ko-KR")}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}`;
}

function trimZero(s: string) {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}
