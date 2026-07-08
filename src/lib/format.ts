export const formatZAR = (n: number) =>
  "R" + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatW = (n: number) => `${Math.round(n).toLocaleString("en-ZA")} W`;
export const formatKWh = (n: number) => `${n.toFixed(2)} kWh`;

export const TARIFF_PER_KWH = 2.85; // R/kWh
