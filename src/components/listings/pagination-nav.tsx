import Link from "next/link";

import type { PaginationMetadata } from "@/lib/types";

type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

type Props = PaginationMetadata & {
  basePath: string;
  queryParams?: Record<string, string | undefined>;
  fragment?: string;
  itemLabel?: string;
};

function pageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  for (let page = Math.max(2, currentPage - 2); page <= Math.min(totalPages - 1, currentPage + 2); page += 1) {
    pages.add(page);
  }

  const sorted = [...pages].sort((first, second) => first - second);
  const items: PaginationItem[] = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) {
      items.push(previous === 1 ? "ellipsis-start" : "ellipsis-end");
    }
    items.push(page);
  });
  return items;
}

export function buildPaginationHref(
  basePath: string,
  page: number,
  queryParams: Record<string, string | undefined> = {},
  fragment?: string
) {
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value && key !== "page") params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}${fragment ? `#${fragment}` : ""}`;
}

export function PaginationNav({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  basePath,
  queryParams = {},
  fragment,
  itemLabel = "properties"
}: Props) {
  if (!totalItems) return null;
  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-semibold text-slate-500">
        Showing {firstItem}-{lastItem} of {totalItems} {itemLabel}
      </p>
      {totalPages > 1 ? (
        <nav aria-label={`${itemLabel} pages`} className="flex flex-wrap items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link
              href={buildPaginationHref(basePath, currentPage - 1, queryParams, fragment)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              Previous
            </Link>
          ) : null}
          {pageItems(currentPage, totalPages).map((item) =>
            typeof item === "number" ? (
              <Link
                key={item}
                href={buildPaginationHref(basePath, item, queryParams, fragment)}
                aria-current={item === currentPage ? "page" : undefined}
                className={`grid h-10 w-10 place-items-center rounded-full text-sm font-black ${
                  item === currentPage ? "bg-slate-950 text-white" : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {item}
              </Link>
            ) : (
              <span key={item} aria-hidden="true" className="px-1 text-slate-400">...</span>
            )
          )}
          {currentPage < totalPages ? (
            <Link
              href={buildPaginationHref(basePath, currentPage + 1, queryParams, fragment)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
