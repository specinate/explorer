import type { NextRequest } from "next/server";

import { cachedJson, parseTaxonIds } from "@/app/lib/api-params";
import { getBulkSpeciesPlacements } from "@/app/lib/inaturalist-server";

/**
 * GET /api/sightings?taxonIds=1,2,3 — globe coordinates for a batch of species,
 * keyed by taxon id. Ids missing from the response could not be placed from the
 * batch and need /api/species/[id]/placement.
 *
 * The upstream pages behind this total megabytes; the response is a few hundred
 * bytes, because the shaping happens on this side of the wire.
 */
export async function GET(request: NextRequest) {
  const taxonIds = parseTaxonIds(request.nextUrl.searchParams.get("taxonIds"));
  return cachedJson(await getBulkSpeciesPlacements(taxonIds));
}
