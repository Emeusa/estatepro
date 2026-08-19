import "server-only";

import { GoogleAuth } from "google-auth-library";

import type { SeoIndexingStatusRecord } from "@/lib/types";
import { captureServerError } from "@/lib/security/logger";
import { getAbsoluteSeoUrl, syncSeoDiscoveryTargets } from "@/modules/seo/seo-discovery.service";
import {
  classifySeoInspection,
  getNextSeoInspectionAt,
  type SearchConsoleIndexStatus
} from "@/modules/seo/seo-inspection";
import {
  createSeoIndexingAdminNotification,
  listDueSeoIndexTargets,
  updateSeoIndexInspection
} from "@/modules/seo/seo-indexing.repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

type SearchConsoleInspectionResponse = {
  inspectionResult?: {
    indexStatusResult?: SearchConsoleIndexStatus;
  };
};

type DueSeoTarget = SeoIndexingStatusRecord & {
  technicalAlertedAt: string | null;
  delayedAlertedAt: string | null;
};

function getSearchConsoleConfig() {
  if (process.env.GOOGLE_SEARCH_CONSOLE_ENABLED !== "true") return null;
  const clientEmail = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const property = process.env.GOOGLE_SEARCH_CONSOLE_PROPERTY?.trim();
  if (!clientEmail || !privateKey || !property) return null;
  return { clientEmail, privateKey, property };
}

async function inspectSearchConsoleUrl(path: string): Promise<SearchConsoleIndexStatus> {
  const config = getSearchConsoleConfig();
  if (!config) throw new Error("Search Console monitoring is not configured.");
  const auth = new GoogleAuth({
    credentials: { client_email: config.clientEmail, private_key: config.privateKey },
    scopes: [SEARCH_CONSOLE_SCOPE]
  });
  const client = await auth.getClient();
  const response = await client.request<SearchConsoleInspectionResponse>({
    url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    method: "POST",
    data: {
      inspectionUrl: getAbsoluteSeoUrl(path),
      siteUrl: config.property,
      languageCode: "en-US"
    },
    timeout: 15000
  });
  return response.data.inspectionResult?.indexStatusResult ?? {};
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

async function persistInspection(target: DueSeoTarget, status: SearchConsoleIndexStatus, now: Date) {
  const classification = classifySeoInspection(status);
  const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(target.eligibleAt).getTime()) / DAY_MS));
  const shouldAlertTechnical = classification.technicalIssue && !target.technicalAlertedAt;
  const shouldAlertDelayed = !classification.googleIndexed && !classification.technicalIssue && ageDays >= 30 && !target.delayedAlertedAt;
  const timestamp = now.toISOString();

  if (shouldAlertTechnical) {
    await createSeoIndexingAdminNotification({
      path: target.path,
      alertType: "technical",
      title: "SEO indexing issue detected",
      message: `${target.path} has a crawl, indexing, fetch, or canonical issue in Google Search Console.`,
      priority: "high"
    });
  } else if (shouldAlertDelayed) {
    await createSeoIndexingAdminNotification({
      path: target.path,
      alertType: "delayed",
      title: "SEO page still not indexed",
      message: `${target.path} has remained eligible and discoverable for at least 30 days without being indexed by Google.`,
      priority: "normal"
    });
  }

  await updateSeoIndexInspection(target.path, {
    inspectedAt: timestamp,
    nextInspectionAt: getNextSeoInspectionAt(target.eligibleAt, now, classification).toISOString(),
    googleVerdict: status.verdict ?? null,
    googleIndexed: classification.googleIndexed,
    coverageState: status.coverageState ?? null,
    robotsTxtState: status.robotsTxtState ?? null,
    indexingState: status.indexingState ?? null,
    pageFetchState: status.pageFetchState ?? null,
    lastCrawlTime: status.lastCrawlTime ?? null,
    userCanonical: status.userCanonical ?? null,
    googleCanonical: status.googleCanonical ?? null,
    technicalIssue: classification.technicalIssue,
    lastError: null,
    technicalAlertedAt: shouldAlertTechnical ? timestamp : undefined,
    delayedAlertedAt: shouldAlertDelayed ? timestamp : undefined
  });
  return classification;
}

export async function runSeoIndexingMaintenance(input?: {
  now?: Date;
  maxInspections?: number;
  inspect?: (path: string) => Promise<SearchConsoleIndexStatus>;
}) {
  const now = input?.now ?? new Date();
  const maxInspections = Math.min(100, Math.max(1, input?.maxInspections ?? 100));
  const sync = await syncSeoDiscoveryTargets();
  if (!getSearchConsoleConfig() && !input?.inspect) {
    return { ...sync, monitoringEnabled: false, inspected: 0, indexed: 0, technicalIssues: 0, failed: 0 };
  }

  const due = await listDueSeoIndexTargets(now, maxInspections) as DueSeoTarget[];
  let indexed = 0;
  let technicalIssues = 0;
  let failed = 0;
  async function inspectTarget(target: DueSeoTarget) {
    try {
      const status = await (input?.inspect ?? inspectSearchConsoleUrl)(target.path);
      const classification = await persistInspection(target, status, now);
      if (classification.googleIndexed) indexed += 1;
      if (classification.technicalIssue) technicalIssues += 1;
    } catch (error) {
      failed += 1;
      captureServerError(error, { service: "seo_indexing", path: target.path });
      await updateSeoIndexInspection(target.path, {
        inspectedAt: now.toISOString(),
        nextInspectionAt: addDays(now, 1).toISOString(),
        googleVerdict: target.googleVerdict,
        googleIndexed: target.googleIndexed,
        coverageState: target.coverageState,
        robotsTxtState: target.robotsTxtState,
        indexingState: target.indexingState,
        pageFetchState: target.pageFetchState,
        lastCrawlTime: target.lastCrawlTime,
        userCanonical: target.userCanonical,
        googleCanonical: target.googleCanonical,
        technicalIssue: target.technicalIssue,
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Search Console inspection failed."
      }).catch(() => undefined);
    }
  }

  for (let start = 0; start < due.length; start += 5) {
    await Promise.all(due.slice(start, start + 5).map(inspectTarget));
  }

  return {
    ...sync,
    monitoringEnabled: true,
    inspected: due.length,
    indexed,
    technicalIssues,
    failed
  };
}
