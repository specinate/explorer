import type { NextRequest } from "next/server";

import {
  BAD_TAXON_ID,
  cachedJson,
  clampPerPage,
  parseTaxonId,
} from "@/app/lib/api-params";
import { getSpeciesObservations } from "@/app/lib/inaturalist-server";

/** GET /api/species/[id]/observations?perPage= — recent research-grade sightings. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const taxonId = parseTaxonId((await params).id);
  if (taxonId === null) return BAD_TAXON_ID;

  const perPage = clampPerPage(request.nextUrl.searchParams.get("perPage"), 50);
  return cachedJson(await getSpeciesObservations(taxonId, perPage));
}
