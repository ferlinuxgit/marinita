export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const moneyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatMoney(value: number) {
  return moneyFormatter.format(value);
}
