import { BAD_TAXON_ID, cachedJson, parseTaxonId } from "@/app/lib/api-params";
import { getSpeciesDetails } from "@/app/lib/inaturalist-server";

/** GET /api/species/[id] — full record for one taxon. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const taxonId = parseTaxonId((await params).id);
  if (taxonId === null) return BAD_TAXON_ID;

  return cachedJson(await getSpeciesDetails(taxonId));
}
