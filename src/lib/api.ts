"use client";

type Options = RequestInit & {
  retries?: number;
  retryDelayMs?: number;
};

export class ApiRequestError extends Error {
  fields?: Record<string, string>;
  status?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(url: string, options: Options = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 500;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new ApiRequestError(body.message ?? body.error ?? "Request failed");
        error.status = response.status;
        if (body.fields && typeof body.fields === "object") {
          error.fields = body.fields as Record<string, string>;
        }
        throw error;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status && error.status < 500) {
        throw error;
      }

      if (attempt === retries) {
        throw error;
      }
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw new Error("Unreachable");
}
