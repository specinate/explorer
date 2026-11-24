/**
 * Shared iNaturalist types, IUCN presentation helpers, and the browser-side
 * client for our own API routes.
 *
 * Everything here is safe to ship: data shapes, the published IUCN category
 * table, and colour/label lookups the components need during render. The query
 * strategies and our conservation heuristics live in inaturalist-server.ts,
 * which is `server-only` and reachable only through app/api/.
 */

export interface iNaturalistTaxon {
  id: number;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    medium_url?: string;
    attribution?: string;
  };
  conservation_status?: {
    place_id: number;
    place: {
      name: string;
    };
    // Authority-specific code: "EN"/"en" from IUCN, but e.g. "g4" from NatureServe
    status: string;
    authority?: string;
    // IUCN-equivalent category as a number, whatever the authority (see IUCN_CODE_BY_RANK)
    iucn?: number;
  };
  wikipedia_url?: string;
  wikipedia_summary?: string;
  iconic_taxon_name?: string;
  // Kingdom down to genus; only sent with a single taxon's full record (/taxa/:id)
  ancestors?: Array<{
    id: number;
    name: string;
    rank: string;
    preferred_common_name?: string;
  }>;
  observations_count?: number;
  establishment_means?: string;
  native?: boolean;
}

export interface iNaturalistObservation {
  id: number;
  uuid: string;
  quality_grade: string;
  observed_on: string;
  taxon: iNaturalistTaxon;
  // The API sends "lat,lng" as a string; geojson holds the same point as [lng, lat]
  location?: string | null;
  geojson?: { type: string; coordinates: [number, number] } | null;
  place_guess?: string;
  description?: string;
  photos?: Array<{
    url: string;
    attribution?: string;
  }>;
  user?: {
    login: string;
  };
}

export interface ConservationDetail {
  place?: {
    name: string;
  };
  status?: string;
  threats?: Array<{
    severity: string;
    [key: string]: unknown;
  }>;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Latitude/longitude of a sighting, or null if it has no usable coordinates. */
export function getSightingLatLng(obs: iNaturalistObservation): LatLng | null {
  const coords = obs.geojson?.coordinates;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    return { lat: coords[1], lng: coords[0] };
  }
  const [lat, lng] = (obs.location ?? "").split(",").map(Number);
  if (Number.isFinite(lat) && Number.isFinite(lng) && obs.location) {
    return { lat, lng };
  }
  return null;
}

/* ------------------------------- IUCN tables ------------------------------ */

export const IUCN_STATUS_MAPPING: Record<string, string> = {
  CR: "Critically Endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near Threatened",
  LC: "Least Concern",
  DD: "Data Deficient",
  NE: "Not Evaluated",
  EW: "Extinct in the Wild",
  EX: "Extinct",
};

/** Short IUCN codes, e.g. "Endangered" -> "EN". */
export const IUCN_CODE_BY_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(IUCN_STATUS_MAPPING).map(([code, name]) => [name, code]),
);

/** iNaturalist's numeric `iucn` field -> IUCN category code. */
const IUCN_CODE_BY_RANK: Record<number, string> = {
  0: "NE",
  5: "DD",
  10: "LC",
  20: "NT",
  30: "VU",
  40: "EN",
  50: "CR",
  60: "EW",
  70: "EX",
};

/** Solid pill styles for a species' status, in the IUCN Red List's own colours. */
const STATUS_BADGE_STYLES: Record<string, string> = {
  "Critically Endangered": "bg-iucn-cr text-white",
  Endangered: "bg-iucn-en text-neutral-900",
  Vulnerable: "bg-iucn-vu text-neutral-900",
  "Near Threatened": "bg-iucn-nt text-neutral-900",
  "Least Concern": "bg-iucn-lc text-neutral-900",
};

/**
 * "Not Evaluated" here usually means iNaturalist has no status on file, not
 * that the species is low risk, so present it as missing information rather
 * than a rating.
 */
export function getStatusBadge(status: string): { label: string; className: string } {
  if (status === "Not Evaluated") {
    return { label: "Not assessed", className: "bg-gray-500/80 text-white" };
  }
  return {
    label: status,
    className: STATUS_BADGE_STYLES[status] || "bg-gray-500/80 text-white",
  };
}

/** Globe marker colours: IUCN category colours (same as --iucn-* in globals.css). */
const STATUS_MARKER_COLORS: Record<string, string> = {
  "Critically Endangered": "#d81e05",
  Endangered: "#fc7f3f",
  Vulnerable: "#f9e814",
  "Near Threatened": "#cce226",
  "Least Concern": "#60c659",
};

export function getStatusMarkerColor(status: string): string {
  return STATUS_MARKER_COLORS[status] || "#9ca3af";
}

/**
 * IUCN code (e.g. "EN") for a taxon. Prefers the numeric `iucn` field, which
 * iNaturalist fills for every authority; status codes vary in case and aren't
 * IUCN categories for other authorities.
 */
export function getIUCNCodeForTaxon(taxon: iNaturalistTaxon): string | null {
  const cs = taxon.conservation_status;
  if (!cs) return null;
  if (cs.iucn !== undefined && IUCN_CODE_BY_RANK[cs.iucn]) return IUCN_CODE_BY_RANK[cs.iucn];
  const code = cs.status?.toUpperCase();
  return code && IUCN_STATUS_MAPPING[code] ? code : null;
}

export function getIUCNStatus(taxon: iNaturalistTaxon): string {
  const code = getIUCNCodeForTaxon(taxon);
  return code ? IUCN_STATUS_MAPPING[code] : "Not Evaluated";
}

/* --------------------------- Browser API client --------------------------- */

/** GET one of our own routes, returning `fallback` on any failure. */
async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Request failed: ${path}`, error);
    return fallback;
  }
}

/**
 * Same surface the components have always used, now backed by our API routes
 * instead of calling api.inaturalist.org from the browser.
 */
export const inaturalistAPI = {
  async searchSpecies(
    query: string,
    perPage = 50,
    iucnStatus?: string,
  ): Promise<iNaturalistTaxon[]> {
    const params = new URLSearchParams({ perPage: String(perPage) });
    if (query) params.set("q", query);
    if (iucnStatus && iucnStatus !== "all") params.set("status", iucnStatus);
    return get<iNaturalistTaxon[]>(`/api/species?${params}`, []);
  },

  async getSpeciesDetails(taxonId: number): Promise<iNaturalistTaxon | null> {
    return get<iNaturalistTaxon | null>(`/api/species/${taxonId}`, null);
  },

  async getSpeciesObservations(
    taxonId: number,
    perPage = 50,
  ): Promise<iNaturalistObservation[]> {
    return get<iNaturalistObservation[]>(
      `/api/species/${taxonId}/observations?perPage=${perPage}`,
      [],
    );
  },

  /** Coordinates for one species' newest wild sighting, or null if it has none. */
  async getSpeciesPlacement(taxonId: number): Promise<LatLng | null> {
    return get<LatLng | null>(`/api/species/${taxonId}/placement`, null);
  },

  /**
   * Coordinates for a batch of species. Ids absent from the result could not be
   * placed from the batch and need an individual lookup.
   *
   * The server shapes this down from megabytes of observation records to a few
   * hundred bytes, so the browser never sees the raw sightings.
   */
  async getBulkSpeciesPlacements(taxonIds: number[]): Promise<Record<number, LatLng>> {
    if (taxonIds.length === 0) return {};
    const params = new URLSearchParams({ taxonIds: taxonIds.join(",") });
    return get<Record<number, LatLng>>(`/api/sightings?${params}`, {});
  },

  // Pure, data already in hand — kept here so render paths don't hit the network
  getIUCNCodeForTaxon,
  getIUCNStatus,
};
