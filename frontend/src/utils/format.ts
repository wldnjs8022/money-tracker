export const krw = (value: number) => `${value.toLocaleString("ko-KR")}원`;

export const signedKrw = (value: number) => {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}${Math.abs(value).toLocaleString("ko-KR")}원`;
};

export const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
