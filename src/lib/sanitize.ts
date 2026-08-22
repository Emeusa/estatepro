const collapseWhitespace = /\s+/g;

export function sanitizeText(input: string) {
  return input
    .replace(/[<>]/g, "")
    .replace(collapseWhitespace, " ")
    .trim();
}

export function normalizePhone(input: string) {
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+234") && digits.startsWith("0")) {
    return `+234${digits.slice(1)}`;
  }
  return digits;
}

export function slugifyLocation(parts: string[]) {
  return parts
    .map((part) =>
      sanitizeText(part)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    )
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
