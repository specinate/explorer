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
    status: string;
    authority?: string;
  };
  wikipedia_url?: string;
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
  location: [number, number];
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

export interface iNaturalistPlace {
  id: number;
  name: string;
  display_name: string;
  location: [number, number];
  bbox: [number, number, number, number];
  place_type: number;
  geometry_geojson?: {
    type: string;
    coordinates: unknown;
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

// IUCN Status mapping
export const IUCN_STATUS_MAPPING: Record<string, string> = {
  'CR': 'Critically Endangered',
  'EN': 'Endangered', 
  'VU': 'Vulnerable',
  'NT': 'Near Threatened',
  'LC': 'Least Concern',
  'DD': 'Data Deficient',
  'NE': 'Not Evaluated'
};

export const IUCN_COLOR_MAPPING: Record<string, string> = {
  // Formal IUCN Statuses
  'Critically Endangered': 'bg-red-100 text-red-700',
  'Endangered': 'bg-orange-100 text-orange-700',
  'Vulnerable': 'bg-yellow-100 text-yellow-700',
  'Near Threatened': 'bg-blue-100 text-blue-700',
  'Least Concern': 'bg-green-100 text-green-700',
  'Data Deficient': 'bg-gray-100 text-gray-700',
  'Not Evaluated': 'bg-gray-100 text-gray-700',
  
  // Observation-Based Statuses (IUCN Coverage Gap Solution)
  'Widespread Species': 'bg-green-100 text-green-700',
  'Common Species': 'bg-green-100 text-green-700',
  'Moderately Observed': 'bg-blue-100 text-blue-700',
  'Uncommon Species': 'bg-yellow-100 text-yellow-700',
  'Rarely Observed': 'bg-orange-100 text-orange-700',
  'No Observations': 'bg-red-100 text-red-700'
};

// Cache configuration
const CACHE_DURATION = 8 * 24 * 60 * 60 * 1000; // 8 days in milliseconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + CACHE_DURATION
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; entries: Array<{ key: string; age: number; expiresIn: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      expiresIn: entry.expiresAt - now
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

class iNaturalistAPI {
  private baseURL = 'https://api.inaturalist.org/v1';
  private cache = new CacheManager();

  constructor() {
    // Clean up expired cache entries every hour
    setInterval(() => {
      this.cache.cleanup();
    }, 60 * 60 * 1000);
  }
  
  async searchSpecies(query: string, perPage: number = 50, iucnStatus?: string): Promise<iNaturalistTaxon[]> {
    const cacheKey = `search_species_${query}_${perPage}_${iucnStatus || 'all'}`;
    
    // Check cache first
    const cachedResult = this.cache.get<iNaturalistTaxon[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        q: query,
        per_page: perPage.toString(),
        order: 'desc',
        order_by: 'observations_count',
        rank: 'species', // Only species level
        iconic_taxa: 'Animalia' // Only animals, not plants
      });

      // Add IUCN status filter if specified
      if (iucnStatus && iucnStatus !== 'all') {
        // Handle multiple IUCN statuses (comma-separated)
        if (iucnStatus.includes(',')) {
          // Multiple statuses - use them directly as they should be IUCN codes
          params.append('conservation_status', iucnStatus);
        } else {
          // Single status - convert to IUCN code
          const iucnCode = this.getIUCNCode(iucnStatus);
          if (iucnCode) {
            params.append('conservation_status', iucnCode);
          }
        }
      }

      const response = await fetch(`${this.baseURL}/taxa?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Cache the results
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error searching species:', error);
      return [];
    }
  }

  async getSpeciesObservations(taxonId: number, perPage: number = 50): Promise<iNaturalistObservation[]> {
    const cacheKey = `species_observations_${taxonId}_${perPage}`;
    
    // Check cache first
    const cachedResult = this.cache.get<iNaturalistObservation[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/observations?taxon_id=${taxonId}&per_page=${perPage}&order=desc&order_by=created_at&quality_grade=research`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Cache the results
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error fetching observations:', error);
      return [];
    }
  }

  async getNearbySpecies(lat: number, lng: number, radius: number = 50, perPage: number = 50): Promise<iNaturalistObservation[]> {
    const cacheKey = `nearby_species_${lat}_${lng}_${radius}_${perPage}`;
    
    // Check cache first
    const cachedResult = this.cache.get<iNaturalistObservation[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/observations?lat=${lat}&lng=${lng}&radius=${radius}&per_page=${perPage}&order=desc&order_by=created_at&quality_grade=research`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Cache the results
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error fetching nearby species:', error);
      return [];
    }
  }

  async getPlaces(query: string, perPage: number = 50): Promise<iNaturalistPlace[]> {
    const cacheKey = `places_${query}_${perPage}`;
    
    // Check cache first
    const cachedResult = this.cache.get<iNaturalistPlace[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/places?q=${encodeURIComponent(query)}&per_page=${perPage}&place_type=country,state_province,county`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Cache the results
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  }

  async getSpeciesDetails(taxonId: number): Promise<iNaturalistTaxon | null> {
    const cacheKey = `species_details_${taxonId}`;
    
    // Check cache first
    const cachedResult = this.cache.get<iNaturalistTaxon>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(`${this.baseURL}/taxa/${taxonId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const result = data.results?.[0] || null;
      
      // Cache the result
      if (result) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching species details:', error);
      return null;
    }
  }

  getIUCNStatus(taxon: iNaturalistTaxon): string {
    if (taxon.conservation_status?.status) {
      return IUCN_STATUS_MAPPING[taxon.conservation_status.status] || taxon.conservation_status.status;
    }
    return 'Not Evaluated';
  }

  // Get more detailed conservation information
  async getConservationDetails(taxonId: number): Promise<ConservationDetail[]> {
    const cacheKey = `conservation_details_${taxonId}`;
    
    const cachedResult = this.cache.get<ConservationDetail[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Try to get conservation status from multiple sources
      const response = await fetch(`${this.baseURL}/conservation_statuses?taxon_id=${taxonId}`);
      
      if (!response.ok) {
        // Silently handle 404s as many species don't have conservation status data
        if (response.status === 404) {
          this.cache.set(cacheKey, []);
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      // Only log non-404 errors
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('Error fetching conservation details:', error);
      }
      return [];
    }
  }

  // Enhanced IUCN status with comprehensive fallback logic
  getEnhancedIUCNStatus(taxon: iNaturalistTaxon, conservationDetails?: ConservationDetail[]): string {
    // First try the standard conservation_status field
    if (taxon.conservation_status?.status) {
      const status = IUCN_STATUS_MAPPING[taxon.conservation_status.status] || taxon.conservation_status.status;
      return status;
    }

    // If we have additional conservation details, look for global status
    if (conservationDetails && conservationDetails.length > 0) {
      // Look for global IUCN status first
      const globalStatus = conservationDetails.find((detail: ConservationDetail) =>
        detail.place?.name === 'Global' || detail.place?.name === 'Worldwide'
      );
      
      if (globalStatus?.status) {
        return IUCN_STATUS_MAPPING[globalStatus.status] || globalStatus.status;
      }

      // Fall back to any available status
      const anyStatus = conservationDetails.find((detail: ConservationDetail) => detail.status);
      if (anyStatus?.status) {
        return IUCN_STATUS_MAPPING[anyStatus.status] || anyStatus.status;
      }
    }

    // IUCN Coverage Gap Solution: Use observation-based conservation indicators
    return this.getObservationBasedStatus(taxon);
  }

  // Address IUCN coverage gap with observation-based conservation indicators
  private getObservationBasedStatus(taxon: iNaturalistTaxon): string {
    const obsCount = taxon.observations_count || 0;
    
    // High observation count suggests species is doing well
    if (obsCount > 10000) {
      return 'Widespread Species'; // Likely Least Concern equivalent
    }
    
    if (obsCount > 1000) {
      return 'Common Species'; // Likely doing well
    }
    
    if (obsCount > 100) {
      return 'Moderately Observed'; // Neutral status
    }
    
    if (obsCount > 10) {
      return 'Uncommon Species'; // May need attention
    }
    
    if (obsCount > 0) {
      return 'Rarely Observed'; // Potentially at risk
    }
    
    return 'No Observations'; // Possibly extinct or extremely rare
  }

  // Get conservation confidence level
  getConservationConfidence(taxon: iNaturalistTaxon): { level: string; description: string } {
    // Only give High confidence for actual IUCN assessments (not "Not Evaluated")
    if (taxon.conservation_status?.status && 
        taxon.conservation_status.status !== 'NE' && 
        taxon.conservation_status.status !== 'Not Evaluated') {
      return {
        level: 'High',
        description: 'Formal IUCN assessment available'
      };
    }

    const obsCount = taxon.observations_count || 0;
    
    // Medium confidence for species with good observation data
    if (obsCount > 100) {
      return {
        level: 'Medium',
        description: 'Based on observation frequency - species appears stable'
      };
    }
    
    // Low confidence for species with limited observations
    if (obsCount > 0) {
      return {
        level: 'Low',
        description: 'Limited data available - IUCN assessment needed'
      };
    }

    // Very low confidence for species with no observations
    return {
      level: 'Low',
      description: 'No observation data available'
    };
  }

  // Get conservation status explanation for users
  getConservationExplanation(taxon: iNaturalistTaxon): string {
    if (taxon.conservation_status?.status) {
      return `This species has been formally assessed by IUCN (International Union for Conservation of Nature).`;
    }

    const obsCount = taxon.observations_count || 0;
    if (obsCount > 1000) {
      return `This species has not been formally assessed by IUCN, but appears to be doing well based on ${obsCount.toLocaleString()} observations. Only ~7% of species have IUCN assessments.`;
    }

    return `This species has not been formally assessed by IUCN. With only ~7% of the world's species having IUCN assessments, many species remain unevaluated despite being important for conservation.`;
  }

  // Bulk fetch observations for multiple species at once
  async getBulkSpeciesObservations(taxonIds: number[], perPage: number = 5): Promise<Record<number, iNaturalistObservation[]>> {
    const cacheKey = `bulk_observations_${taxonIds.join(',')}_${perPage}`;
    
    const cachedResult = this.cache.get<Record<number, iNaturalistObservation[]>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Make a single API call for all species observations
      const taxonIdQuery = taxonIds.join(',');
      const response = await fetch(`${this.baseURL}/observations?taxon_id=${taxonIdQuery}&per_page=${perPage * taxonIds.length}&has_geo=true&order=desc&order_by=created_at`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const allObservations = data.results || [];
      
      // Group observations by taxon_id
      const observationsByTaxon: Record<number, iNaturalistObservation[]> = {};
      
      // Initialize empty arrays for all taxon IDs
      taxonIds.forEach(id => {
        observationsByTaxon[id] = [];
      });
      
      // Group observations by taxon_id
      allObservations.forEach((obs: iNaturalistObservation) => {
        if (obs.taxon?.id && observationsByTaxon[obs.taxon.id]) {
          // Only add if we haven't reached the per-species limit
          if (observationsByTaxon[obs.taxon.id].length < perPage) {
            observationsByTaxon[obs.taxon.id].push(obs);
          }
        }
      });
      
      this.cache.set(cacheKey, observationsByTaxon);
      return observationsByTaxon;
    } catch (error) {
      console.error('Error fetching bulk species observations:', error);
      // Return empty arrays for all taxon IDs
      const emptyResult: Record<number, iNaturalistObservation[]> = {};
      taxonIds.forEach(id => {
        emptyResult[id] = [];
      });
      return emptyResult;
    }
  }

  // Get threats data for a species
  async getSpeciesThreats(taxonId: number): Promise<Array<{ severity: string }>> {
    const cacheKey = `species_threats_${taxonId}`;
    
    const cachedResult = this.cache.get<Array<{ severity: string }>>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Try the conservation statuses endpoint first
      let response = await fetch(`${this.baseURL}/conservation_statuses?taxon_id=${taxonId}&per_page=100`);
      
      if (!response.ok) {
        // Silently handle 404s as many species don't have conservation status data
        if (response.status === 404) {
          // Try fallback approach without logging 404 errors
          response = await fetch(`${this.baseURL}/taxa/${taxonId}`);
          
          if (!response.ok) {
            // Return empty array for species without data
            this.cache.set(cacheKey, []);
            return [];
          }
        } else {
          console.warn(`Conservation statuses endpoint failed with status ${response.status}, trying alternative approach`);
          
          // Fallback: Try to get threats from the taxon details endpoint
          response = await fetch(`${this.baseURL}/taxa/${taxonId}`);
          
          if (!response.ok) {
            console.warn(`Taxon details endpoint also failed with status ${response.status}`);
            // Return empty array instead of throwing error
            this.cache.set(cacheKey, []);
            return [];
          }
        }
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Extract threats from conservation statuses if available
      let threats: Array<{ severity: string }> = [];
      
      if (results.length > 0 && results[0].threats) {
        threats = results
          .filter((status: ConservationDetail) => status.threats && status.threats.length > 0)
          .flatMap((status: ConservationDetail) => status.threats)
          .filter((threat: { severity: string }) => threat.severity === 'high' || threat.severity === 'medium')
          .slice(0, 5);
      }
      
      this.cache.set(cacheKey, threats);
      return threats;
    } catch (error) {
      console.error('Error fetching species threats:', error);
      // Return empty array instead of throwing error to prevent app crashes
      this.cache.set(cacheKey, []);
      return [];
    }
  }

  // Get inferred threats based on observation patterns and species characteristics
  getInferredThreats(taxon: iNaturalistTaxon): string[] {
    const threats: string[] = [];
    const obsCount = taxon.observations_count || 0;

    // Low observation count might indicate threats
    if (obsCount < 100) {
      threats.push('Limited population visibility');
    }
    
    if (obsCount < 10) {
      threats.push('Potential rarity or decline');
    }

    // Habitat-based threats (could be enhanced with habitat data)
    if (taxon.establishment_means === 'introduced') {
      threats.push('Invasive species competition');
    }

    // Common threats for many species
    threats.push('Habitat loss and fragmentation');
    threats.push('Climate change impacts');

    return threats.slice(0, 3); // Return top 3 inferred threats
  }

  // Get threat severity color
  getThreatSeverityColor(severity: string): string {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  getIUCNColor(status: string): string {
    return IUCN_COLOR_MAPPING[status] || 'bg-gray-100 text-gray-700';
  }

  // Get conservation priority based on IUCN status
  getConservationPriority(status: string): 'critical' | 'high' | 'moderate' | 'low' {
    switch (status) {
      case 'Critically Endangered':
        return 'critical';
      case 'Endangered':
        return 'high';
      case 'Vulnerable':
      case 'Near Threatened':
        return 'moderate';
      default:
        return 'low';
    }
  }

  // Cache management methods
  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache() {
    this.cache.clear();
  }

  cleanupCache() {
    this.cache.cleanup();
  }

  // Convert IUCN status to API code
  getIUCNCode(status: string): string | null {
    const statusMap: Record<string, string> = {
      'Critically Endangered': 'CR',
      'Endangered': 'EN',
      'Vulnerable': 'VU',
      'Near Threatened': 'NT',
      'Least Concern': 'LC',
      'Data Deficient': 'DD',
      'Not Evaluated': 'NE'
    };
    return statusMap[status] || null;
  }

  // Get popular endangered species for globe markers
  async getPopularEndangeredSpecies(): Promise<iNaturalistTaxon[]> {
    const cacheKey = 'popular_endangered_species';
    
    const cachedResult = this.cache.get<iNaturalistTaxon[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Search for endangered animals with high observation counts and geographic data
      const response = await fetch(
        `${this.baseURL}/taxa?conservation_status=EN,CR,VU&iconic_taxa=Animalia&rank=species&per_page=50&order=desc&order_by=observations_count&has_geo=true`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error fetching popular endangered species:', error);
      return [];
    }
  }

  // Get species observations with geographic coordinates
  async getSpeciesObservationsWithGeo(taxonId: number, perPage: number = 20): Promise<iNaturalistObservation[]> {
    const cacheKey = `species_observations_geo_${taxonId}_${perPage}`;
    
    const cachedResult = this.cache.get<iNaturalistObservation[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(
        `${this.baseURL}/observations?taxon_id=${taxonId}&per_page=${perPage}&order=desc&order_by=created_at&quality_grade=research&has_geo=true`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error fetching species observations with geo:', error);
      return [];
    }
  }

  // Force refresh specific data (bypass cache)
  async searchSpeciesFresh(query: string, perPage: number = 50, iucnStatus?: string): Promise<iNaturalistTaxon[]> {
    const cacheKey = `search_species_${query}_${perPage}_${iucnStatus || 'all'}`;
    
    try {
      const params = new URLSearchParams({
        q: query,
        per_page: perPage.toString(),
        order: 'desc',
        order_by: 'observations_count',
        rank: 'species',
        iconic_taxa: 'Animalia'
      });

      if (iucnStatus && iucnStatus !== 'all') {
        const iucnCode = this.getIUCNCode(iucnStatus);
        if (iucnCode) {
          params.append('conservation_status', iucnCode);
        }
      }

      const response = await fetch(`${this.baseURL}/taxa?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const results = data.results || [];
      
      // Update cache with fresh data
      this.cache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error searching species:', error);
      return [];
    }
  }
}

export const inaturalistAPI = new iNaturalistAPI();
