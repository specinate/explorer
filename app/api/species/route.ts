import type { NextRequest } from "next/server";

import {
  cachedJson,
  clampPerPage,
  parseQuery,
  parseStatusFilter,
} from "@/app/lib/api-params";
import { searchSpecies } from "@/app/lib/inaturalist-server";

/** GET /api/species?q=&status=&perPage= — species search. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const results = await searchSpecies(
    parseQuery(params.get("q")),
    clampPerPage(params.get("perPage"), 50),
    parseStatusFilter(params.get("status")),
  );
  return cachedJson(results);
}
