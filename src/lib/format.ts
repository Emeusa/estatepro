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

export function whatsappLink(phone: string, title: string) {
  const message = encodeURIComponent(`Hello, I am interested in ${title}.`);
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${message}`;
}
