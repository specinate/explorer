import { BAD_TAXON_ID, cachedJson, parseTaxonId } from "@/app/lib/api-params";
import { getSpeciesPlacement } from "@/app/lib/inaturalist-server";

/**
 * GET /api/species/[id]/placement — coordinates of the newest wild sighting,
 * for placing one species on the globe. Null when it has no geotagged sighting.
 *
 * Returns coordinates rather than the observation record: the upstream sighting
 * serialises to tens of kilobytes and the globe reads two numbers from it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const taxonId = parseTaxonId((await params).id);
  if (taxonId === null) return BAD_TAXON_ID;

  return cachedJson(await getSpeciesPlacement(taxonId));
}
