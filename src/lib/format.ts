export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos"
  }).format(new Date(value));
}

function capitalizeWord(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

export function toTitleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.split("-").map(capitalizeWord).join("-"))
    .join(" ");
}

export function toNameCase(value: string) {
  return toTitleCase(value);
}

export function whatsappLink(phone: string, title: string) {
  const message = encodeURIComponent(`Hello, I am interested in ${title}.`);
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${message}`;
}
