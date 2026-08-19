const DAY_MS = 24 * 60 * 60 * 1000;

export type SearchConsoleIndexStatus = {
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
};

export type SeoInspectionClassification = {
  googleIndexed: boolean;
  technicalIssue: boolean;
  canonicalMismatch: boolean;
};

function normalizeCanonical(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function classifySeoInspection(status: SearchConsoleIndexStatus): SeoInspectionClassification {
  const googleIndexed = status.verdict === "PASS";
  const canonicalMismatch = Boolean(
    status.googleCanonical &&
    status.userCanonical &&
    normalizeCanonical(status.googleCanonical) !== normalizeCanonical(status.userCanonical)
  );
  const robotsBlocked = status.robotsTxtState === "DISALLOWED";
  const indexingBlocked = [
    "BLOCKED_BY_META_TAG",
    "BLOCKED_BY_HTTP_HEADER",
    "BLOCKED_BY_ROBOTS_TXT"
  ].includes(status.indexingState ?? "");
  const fetchFailed = Boolean(
    status.pageFetchState &&
    status.pageFetchState !== "SUCCESSFUL" &&
    status.pageFetchState !== "PAGE_FETCH_STATE_UNSPECIFIED"
  );
  return {
    googleIndexed,
    canonicalMismatch,
    technicalIssue: robotsBlocked || indexingBlocked || fetchFailed || canonicalMismatch
  };
}

export function getNextSeoInspectionAt(
  eligibleAtValue: string,
  now: Date,
  classification: SeoInspectionClassification
) {
  if (classification.googleIndexed) return addDays(now, 30);
  if (classification.technicalIssue) return addDays(now, 1);
  const eligibleAt = new Date(eligibleAtValue);
  const ageDays = Math.max(0, Math.floor((now.getTime() - eligibleAt.getTime()) / DAY_MS));
  if (ageDays < 10) return addDays(eligibleAt, 10);
  if (ageDays < 30) return addDays(eligibleAt, 30);
  return addDays(now, 7);
}
