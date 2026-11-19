const supportedNumberFormats = ["en-US", "en-GB", "de-DE"];
const dateLocales = {
  mdy: "en-US",
  dmy: "en-GB",
  iso: "sv-SE"
};
const supportedDateFormats = Object.keys(dateLocales);

let preferences = {
  dateFormat: "mdy",
  numberFormat: "en-US"
};

export function setFormattingPreferences(nextPreferences = {}) {
  preferences = {
    dateFormat: supportedDateFormats.includes(nextPreferences.dateFormat) ? nextPreferences.dateFormat : "mdy",
    numberFormat: supportedNumberFormats.includes(nextPreferences.numberFormat) ? nextPreferences.numberFormat : "en-US"
  };
}

export function formatNumber(value, options) {
  return new Intl.NumberFormat(preferences.numberFormat, options).format(value);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat(preferences.numberFormat, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(value, options = { year: "numeric", month: "short", day: "numeric" }) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(dateLocales[preferences.dateFormat], options).format(date);
}
