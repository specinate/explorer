/**
 * Shared request-parameter handling for the route handlers in app/api/.
 *
 * These routes are publicly reachable, so every value is clamped rather than
 * passed through: without this the routes would work as an open, uncapped
 * proxy to api.inaturalist.org under our origin.
 */

import { NextResponse } from "next/server";

/** Most observations the upstream API will usefully return in one page. */
const MAX_PER_PAGE = 100;

/** Cap on ids per bulk request, to bound the upstream query string. */
const MAX_BULK_IDS = 50;

/** Longest search term we forward; anything beyond this is noise. */
const MAX_QUERY_LENGTH = 100;

/** Parse `perPage`, falling back to `fallback` and clamping to a sane range. */
export function clampPerPage(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_PER_PAGE);
}

/** A positive integer taxon id, or null if the segment isn't one. */
export function parseTaxonId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

/** Parse a comma-separated `taxonIds` list into bounded, unique, valid ids. */
export function parseTaxonIds(value: string | null): number[] {
  if (!value) return [];
  const ids = value
    .split(",")
    .map((part) => parseTaxonId(part.trim()))
    .filter((id): id is number => id !== null);
  return [...new Set(ids)].slice(0, MAX_BULK_IDS);
}

/** Trim and length-cap a free-text search term. */
export function parseQuery(value: string | null): string {
  return (value ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Keep only well-formed IUCN codes or category names from a status filter.
 * Returns undefined when nothing usable is left, meaning "no filter".
 */
export function parseStatusFilter(value: string | null): string | undefined {
  if (!value || value === "all") return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^[A-Za-z ]{2,24}$/.test(part));
  return parts.length > 0 ? parts.join(",") : undefined;
}

export const BAD_TAXON_ID = NextResponse.json({ error: "Invalid taxon id" }, { status: 400 });

/**
 * JSON response with a public cache window. The data is public and slow-moving,
 * so let the CDN and browser serve repeats without reaching our function.
 */
export function cachedJson(data: unknown, seconds = 3600): NextResponse {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=86400`,
    },
  });
}
