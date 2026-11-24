/**
 * Server-only iNaturalist access layer.
 *
 * `server-only` makes importing this from a client component a build error, so
 * the query strategies and conservation heuristics below never reach the
 * browser. Client components reach these through the route handlers in
 * app/api/, via the thin client in app/lib/inaturalist.ts.
 *
 * Caching is Next's Data Cache rather than a per-tab Map, so one fetch of a
 * given species serves every visitor for the revalidation window.
 */

import "server-only";

import {
  IUCN_STATUS_MAPPING,
  getIUCNCodeForTaxon,
  getIUCNStatus,
  getSightingLatLng,
  type ConservationDetail,
  type LatLng,
  type iNaturalistObservation,
  type iNaturalistTaxon,
} from "./inaturalist";

const BASE_URL = "https://api.inaturalist.org/v1";

/** 8 days, in seconds. Conservation status and sighting history move slowly. */
const REVALIDATE = 8 * 24 * 60 * 60;

/**
 * Observations per upstream page when placing markers.
 *
 * Next's Data Cache rejects anything over 2MB, and a single iNaturalist
 * observation serialises to roughly 50KB (full taxon record, photo metadata,
 * identifications), so ~37 observations is the ceiling. Asking for 60 in one
 * request returned 3.5MB and silently went uncached on every visit; three
 * pages of 20 carry the same coverage and each page caches.
 */
const PLACEMENT_PAGE_SIZE = 20;

/** Pages to walk per batch before falling back to per-species lookups. */
const PLACEMENT_MAX_PAGES = 3;

/** Iconic groups that aren't animals; /taxa/autocomplete ignores iconic_taxa. */
const NON_ANIMAL_GROUPS = new Set(["Plantae", "Fungi", "Chromista", "Protozoa"]);

/**
 * GET from the iNaturalist API through the shared Data Cache.
 * Returns null on any non-OK response so callers can fall back quietly.
 */
async function inat<T = unknown>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      next: { revalidate: REVALIDATE },
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`iNaturalist request failed: ${path}`, error);
    return null;
  }
}

type Paged<T> = { results?: T[] };

/** IUCN category code for a status name, e.g. "Endangered" -> "EN". */
function iucnCode(status: string): string | null {
  const entry = Object.entries(IUCN_STATUS_MAPPING).find(([, name]) => name === status);
  if (entry) return entry[0];
  const upper = status.toUpperCase();
  return IUCN_STATUS_MAPPING[upper] ? upper : null;
}

/**
 * Search species by name, optionally filtered to IUCN categories.
 *
 * /taxa/autocomplete ranks by name match ("tiger" -> Tiger) where /taxa ranks
 * by observation count and buries the obvious hit. Autocomplete returns 30 per
 * page and ignores iconic_taxa, so this pulls three pages, drops non-animals,
 * and applies the status filter here because the endpoint cannot.
 */
export async function searchSpecies(
  query: string,
  perPage = 50,
  iucnStatus?: string,
): Promise<iNaturalistTaxon[]> {
  const statusCodes =
    !iucnStatus || iucnStatus === "all"
      ? []
      : iucnStatus
          .split(",")
          .map((value) => iucnCode(value.trim()) || value.trim().toUpperCase());

  if (query) {
    const pages = await Promise.all(
      [1, 2, 3].map(async (page) => {
        const params = new URLSearchParams({
          q: query,
          rank: "species",
          is_active: "true",
          per_page: "30",
          page: String(page),
        });
        const data = await inat<Paged<iNaturalistTaxon>>(`/taxa/autocomplete?${params}`);
        return data?.results ?? [];
      }),
    );

    const seen = new Set<number>();
    return pages
      .flat()
      .filter((taxon) => {
        if (seen.has(taxon.id)) return false;
        seen.add(taxon.id);
        return (
          !!taxon.iconic_taxon_name &&
          !NON_ANIMAL_GROUPS.has(taxon.iconic_taxon_name) &&
          (statusCodes.length === 0 ||
            statusCodes.includes(getIUCNCodeForTaxon(taxon) ?? ""))
        );
      })
      .slice(0, perPage);
  }

  if (statusCodes.length > 0) {
    // /taxa ignores status filters; species counts from observations honour csi
    const params = new URLSearchParams({
      csi: statusCodes.join(","),
      iconic_taxa: "Animalia",
      rank: "species",
      per_page: String(perPage),
    });
    const data = await inat<Paged<{ taxon: iNaturalistTaxon }>>(
      `/observations/species_counts?${params}`,
    );
    return (data?.results ?? []).map((row) => row.taxon);
  }

  const params = new URLSearchParams({
    per_page: String(perPage),
    order: "desc",
    order_by: "observations_count",
    rank: "species",
    iconic_taxa: "Animalia",
  });
  const data = await inat<Paged<iNaturalistTaxon>>(`/taxa?${params}`);
  return data?.results ?? [];
}

export async function getSpeciesDetails(taxonId: number): Promise<iNaturalistTaxon | null> {
  const data = await inat<Paged<iNaturalistTaxon>>(`/taxa/${taxonId}`);
  return data?.results?.[0] ?? null;
}

export async function getSpeciesObservations(
  taxonId: number,
  perPage = 50,
): Promise<iNaturalistObservation[]> {
  const params = new URLSearchParams({
    taxon_id: String(taxonId),
    per_page: String(perPage),
    order: "desc",
    // Newest sighting first, not newest upload: the profile's "last seen" reads the first one
    order_by: "observed_on",
    quality_grade: "research",
  });
  const data = await inat<Paged<iNaturalistObservation>>(`/observations?${params}`);
  return data?.results ?? [];
}

/**
 * Most recent wild sighting with coordinates, for placing a species on the globe.
 */
export async function getLatestSighting(
  taxonId: number,
): Promise<iNaturalistObservation | null> {
  const params = new URLSearchParams({
    taxon_id: String(taxonId),
    per_page: "1",
    has_geo: "true",
    captive: "false",
    quality_grade: "research",
    order: "desc",
    order_by: "observed_on",
  });
  const data = await inat<Paged<iNaturalistObservation>>(`/observations?${params}`);
  return data?.results?.[0] ?? null;
}

/** Coordinates of the newest wild sighting of one species, if it has any. */
export async function getSpeciesPlacement(taxonId: number): Promise<LatLng | null> {
  const sighting = await getLatestSighting(taxonId);
  return sighting ? getSightingLatLng(sighting) : null;
}

/**
 * Map coordinates for a batch of species in as few requests as possible.
 *
 * Returns only the species that could be placed; callers treat a missing id as
 * unplaced and look it up individually. The endpoint returns the newest
 * sightings across all requested taxa rather than a quota each, so
 * widely-observed species crowd out rare ones — hence the paging and the
 * per-species fallback.
 *
 * Shaping happens here rather than in the browser: the upstream pages total
 * megabytes, while what the globe needs is two numbers per species.
 */
export async function getBulkSpeciesPlacements(
  taxonIds: number[],
): Promise<Record<number, LatLng>> {
  const placements: Record<number, LatLng> = {};
  if (taxonIds.length === 0) return placements;

  const base = {
    taxon_id: taxonIds.join(","),
    per_page: String(PLACEMENT_PAGE_SIZE),
    has_geo: "true",
    captive: "false",
    quality_grade: "research",
    order: "desc",
    order_by: "observed_on",
  };

  const pages = await Promise.all(
    Array.from({ length: PLACEMENT_MAX_PAGES }, (_, index) => {
      const params = new URLSearchParams({ ...base, page: String(index + 1) });
      return inat<Paged<iNaturalistObservation>>(`/observations?${params}`);
    }),
  );

  for (const page of pages) {
    for (const obs of page?.results ?? []) {
      const id = obs.taxon?.id;
      if (id === undefined || placements[id]) continue;
      const latLng = getSightingLatLng(obs);
      if (latLng) placements[id] = latLng;
    }
  }
  return placements;
}

export async function getConservationDetails(taxonId: number): Promise<ConservationDetail[]> {
  const data = await inat<Paged<ConservationDetail>>(`/conservation_statuses?taxon_id=${taxonId}`);
  return data?.results ?? [];
}

/**
 * Threats recorded against a species' conservation statuses, high and medium only.
 * Many species have none on file, in which case this is empty.
 */
export async function getSpeciesThreats(taxonId: number): Promise<Array<{ severity: string }>> {
  const data = await inat<Paged<ConservationDetail>>(
    `/conservation_statuses?taxon_id=${taxonId}&per_page=100`,
  );
  const results = data?.results ?? [];
  if (results.length === 0 || !results[0].threats) return [];

  return results
    .filter((status) => status.threats && status.threats.length > 0)
    .flatMap((status) => status.threats ?? [])
    .filter((threat) => threat.severity === "high" || threat.severity === "medium")
    .slice(0, 5);
}

/* ------------------------------------------------------------------------- *
 * IUCN coverage-gap heuristics
 *
 * Only ~7% of described species carry a formal IUCN assessment, so these
 * derive a provisional signal from observation volume for the rest. They are
 * deliberately server-side: they are our interpretation, not iNaturalist data,
 * and they must never be mistaken for a Red List category.
 * ------------------------------------------------------------------------- */

/** Provisional status from observation volume, when no assessment exists. */
function getObservationBasedStatus(taxon: iNaturalistTaxon): string {
  const count = taxon.observations_count || 0;
  if (count > 10000) return "Widespread Species";
  if (count > 1000) return "Common Species";
  if (count > 100) return "Moderately Observed";
  if (count > 10) return "Uncommon Species";
  if (count > 0) return "Rarely Observed";
  return "No Observations";
}

/**
 * Formal IUCN category where one exists, otherwise a global status from the
 * conservation_statuses record, otherwise the observation-based fallback.
 */
export function getEnhancedIUCNStatus(
  taxon: iNaturalistTaxon,
  conservationDetails?: ConservationDetail[],
): string {
  const status = getIUCNStatus(taxon);
  if (status !== "Not Evaluated") return status;

  if (conservationDetails && conservationDetails.length > 0) {
    const global = conservationDetails.find(
      (detail) => detail.place?.name === "Global" || detail.place?.name === "Worldwide",
    );
    if (global?.status) return IUCN_STATUS_MAPPING[global.status] || global.status;

    const any = conservationDetails.find((detail) => detail.status);
    if (any?.status) return IUCN_STATUS_MAPPING[any.status] || any.status;
  }

  return getObservationBasedStatus(taxon);
}

/** How much weight to put on the status above. */
export function getConservationConfidence(taxon: iNaturalistTaxon): {
  level: "High" | "Medium" | "Low";
  description: string;
} {
  const assessed =
    taxon.conservation_status?.status &&
    taxon.conservation_status.status !== "NE" &&
    taxon.conservation_status.status !== "Not Evaluated";
  if (assessed) {
    return { level: "High", description: "Formal IUCN assessment available" };
  }

  const count = taxon.observations_count || 0;
  if (count > 100) {
    return {
      level: "Medium",
      description: "Based on observation frequency — species appears stable",
    };
  }
  if (count > 0) {
    return { level: "Low", description: "Limited data available — IUCN assessment needed" };
  }
  return { level: "Low", description: "No observation data available" };
}

/** Plain-language note on where a species' status came from. */
export function getConservationExplanation(taxon: iNaturalistTaxon): string {
  if (taxon.conservation_status?.status) {
    return "This species has been formally assessed by the IUCN (International Union for Conservation of Nature).";
  }

  const count = taxon.observations_count || 0;
  if (count > 1000) {
    return `This species has not been formally assessed by the IUCN, but appears to be doing well based on ${count.toLocaleString()} observations. Only ~7% of species have IUCN assessments.`;
  }
  return "This species has not been formally assessed by the IUCN. With only ~7% of the world's species assessed, many remain unevaluated despite being important for conservation.";
}

/** Threats guessed from observation patterns, where none are on file. */
export function getInferredThreats(taxon: iNaturalistTaxon): string[] {
  const threats: string[] = [];
  const count = taxon.observations_count || 0;

  if (count < 100) threats.push("Limited population visibility");
  if (count < 10) threats.push("Potential rarity or decline");
  if (taxon.establishment_means === "introduced") {
    threats.push("Invasive species competition");
  }
  threats.push("Habitat loss and fragmentation");
  threats.push("Climate change impacts");

  return threats.slice(0, 3);
}

/** Triage bucket for an IUCN status name. */
export function getConservationPriority(
  status: string,
): "critical" | "high" | "moderate" | "low" {
  switch (status) {
    case "Critically Endangered":
      return "critical";
    case "Endangered":
      return "high";
    case "Vulnerable":
    case "Near Threatened":
      return "moderate";
    default:
      return "low";
  }
}
