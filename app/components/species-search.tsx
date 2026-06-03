"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, ChevronDown } from "lucide-react"
import Image from "next/image"
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"
import { SpecinateLoader } from "@/app/components/specinate-loader"

interface SpeciesSearchProps {
  onSelectHotspot: (species: iNaturalistTaxon) => void
  onGlobeSpecies: (species: iNaturalistTaxon[]) => void
}

interface SearchResult {
  id: number;
  name: string;
  commonName?: string;
  status: string;
  observationsCount: number;
  category: string;
  photo?: string;
  confidence: string;
  confidenceDescription: string;
}

export function SpeciesSearch({ onSelectHotspot, onGlobeSpecies }: SpeciesSearchProps) {
  const [searchValue, setSearchValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchCount, setSearchCount] = useState(0)
  const [selectedConfidence, setSelectedConfidence] = useState<string>("all")
  const [hasSearched, setHasSearched] = useState(false)

  const CONFIDENCE_LEVELS = [
    { value: "all", label: "All Confidence Levels" },
    { value: "high", label: "High Confidence (Formal IUCN Assessment)" },
    { value: "medium", label: "Medium Confidence (Based on Observations)" },
    { value: "low", label: "Low Confidence (Limited Data)" },
    { value: "high,medium", label: "Reliable Data (High + Medium)" },
    { value: "high,medium,low", label: "All Species (Including Uncertain)" }
  ]

  // Debounced search function
  const debouncedSearch = useCallback(
    (query: string) => {
      debounce(async () => {
        if (query.length < 2) {
          setSearchResults([])
          setSearchCount(0)
          return
        }

        setIsLoading(true)
        try {
          // Get all species first, then filter by confidence
          const results = await inaturalistAPI.searchSpecies(query, 100) // Get more results to filter from
          
          // Filter by confidence level
          const filteredResults = results.filter(taxon => {
            if (selectedConfidence === "all") return true
            
            const confidence = inaturalistAPI.getConservationConfidence(taxon)
            const selectedLevels = selectedConfidence.split(',')
            return selectedLevels.includes(confidence.level.toLowerCase())
          })
          
          const processedResults = filteredResults
            .filter(taxon => taxon.preferred_common_name || taxon.name)
            .map(taxon => {
              const confidence = inaturalistAPI.getConservationConfidence(taxon)
              console.log(`Species: ${taxon.name}, Observations: ${taxon.observations_count}, Confidence: ${confidence.level}`)
              return {
                id: taxon.id,
                name: taxon.name,
                commonName: taxon.preferred_common_name,
                status: inaturalistAPI.getEnhancedIUCNStatus(taxon),
                observationsCount: taxon.observations_count || 0,
                category: getTaxonCategory(taxon.name),
                photo: taxon.default_photo?.medium_url,
                confidence: confidence.level,
                confidenceDescription: confidence.description
              }
            })
            .sort((a, b) => b.observationsCount - a.observationsCount)

        setSearchResults(processedResults)
        setSearchCount(processedResults.length)
        setHasSearched(true)
        
        // Convert search results to full taxon objects and send to globe
        const fullSpecies = results.filter(taxon => taxon.preferred_common_name || taxon.name)
        onGlobeSpecies(fullSpecies)
        } catch (error) {
          console.error('Error searching species:', error)
          setSearchResults([])
          setSearchCount(0)
        } finally {
          setIsLoading(false)
        }
      }, 300)()
    },
    [selectedConfidence]
  )

  // Helper function to categorize taxa
  const getTaxonCategory = (name: string): string => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('mammal') || lowerName.includes('bear') || lowerName.includes('cat') || lowerName.includes('dog')) return 'Mammal'
    if (lowerName.includes('bird') || lowerName.includes('eagle') || lowerName.includes('owl')) return 'Bird'
    if (lowerName.includes('fish') || lowerName.includes('shark') || lowerName.includes('tuna')) return 'Fish'
    if (lowerName.includes('reptile') || lowerName.includes('snake') || lowerName.includes('lizard')) return 'Reptile'
    if (lowerName.includes('amphibian') || lowerName.includes('frog') || lowerName.includes('salamander')) return 'Amphibian'
    if (lowerName.includes('insect') || lowerName.includes('butterfly') || lowerName.includes('bee')) return 'Insect'
    return 'Animal'
  }

  // Helper function to get confidence color
  const getConfidenceColor = (confidence: string): string => {
    const lowerConfidence = confidence.toLowerCase()
    console.log('Getting color for confidence:', confidence, 'lowercase:', lowerConfidence)
    
    if (lowerConfidence === 'high') {
      console.log('Returning green color for high confidence')
      return 'bg-green-100 text-green-700 border border-green-200'
    }
    if (lowerConfidence === 'medium') {
      console.log('Returning yellow color for medium confidence')
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
    }
    console.log('Returning red color for low confidence')
    return 'bg-red-100 text-red-700 border border-red-200'
  }

  useEffect(() => {
    debouncedSearch(searchValue)
  }, [searchValue, selectedConfidence, debouncedSearch])

  // Ensure default selection is "All Confidence Levels" on mount and load species
  useEffect(() => {
    setSelectedConfidence("all")
    // Load all species when component mounts
    const loadInitialSpecies = async () => {
      console.log('SpeciesSearch: Loading initial species...')
      setIsLoading(true)
      try {
        const results = await inaturalistAPI.searchSpecies('', 100)
        console.log('SpeciesSearch: Got', results.length, 'species from API')
        const filteredResults = results.filter(taxon => taxon.preferred_common_name || taxon.name)
        console.log('SpeciesSearch: Filtered to', filteredResults.length, 'species with names')
        
        const processedResults = filteredResults.map(taxon => {
          const confidence = inaturalistAPI.getConservationConfidence(taxon)
          return {
            id: taxon.id,
            name: taxon.name,
            commonName: taxon.preferred_common_name,
            status: inaturalistAPI.getEnhancedIUCNStatus(taxon),
            observationsCount: taxon.observations_count || 0,
            category: getTaxonCategory(taxon.name),
            photo: taxon.default_photo?.medium_url,
            confidence: confidence.level,
            confidenceDescription: confidence.description
          }
        }).sort((a, b) => b.observationsCount - a.observationsCount)

        setSearchResults(processedResults)
        setSearchCount(processedResults.length)
        setHasSearched(true)
        console.log('SpeciesSearch: Sending', filteredResults.length, 'species to globe')
        onGlobeSpecies(filteredResults)
      } catch (error) {
        console.error('Error loading initial species:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadInitialSpecies()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value)
    setIsOpen(true)
  }

  const handleSpeciesSelect = async (species: SearchResult) => {
    try {
      // Get full species details
      const fullSpecies = await inaturalistAPI.getSpeciesDetails(species.id)
      if (fullSpecies) {
        onSelectHotspot(fullSpecies)
      }
    } catch (error) {
      console.error('Error fetching species details:', error)
    }
    setIsOpen(false)
    setSearchValue("")
  }

  const handleInputClick = () => {
    setIsOpen(true)
  }

  const handleInputBlur = () => {
    // Delay closing to allow clicking on dropdown items
    setTimeout(() => setIsOpen(false), 150)
  }

  const loadSpeciesByConfidence = async () => {
    setIsLoading(true)
    try {
      // Load species and filter by confidence level
      const results = await inaturalistAPI.searchSpecies('', 100)
      
      // Filter by confidence level - if 'all', include all species
      const filteredResults = results.filter(taxon => {
        if (selectedConfidence === 'all') return true
        
        const confidence = inaturalistAPI.getConservationConfidence(taxon)
        const selectedLevels = selectedConfidence.split(',')
        return selectedLevels.includes(confidence.level.toLowerCase())
      })
      
      const processedResults = filteredResults
        .filter(taxon => taxon.preferred_common_name || taxon.name)
        .map(taxon => {
          const confidence = inaturalistAPI.getConservationConfidence(taxon)
          return {
            id: taxon.id,
            name: taxon.name,
            commonName: taxon.preferred_common_name,
            status: inaturalistAPI.getEnhancedIUCNStatus(taxon),
            observationsCount: taxon.observations_count || 0,
            category: getTaxonCategory(taxon.name),
            photo: taxon.default_photo?.medium_url,
            confidence: confidence.level,
            confidenceDescription: confidence.description
          }
        })
        .sort((a, b) => b.observationsCount - a.observationsCount)

      setSearchResults(processedResults)
      setSearchCount(processedResults.length)
      setHasSearched(true)
      
      // Convert search results to full taxon objects and send to globe
      const fullSpecies = filteredResults.filter(taxon => taxon.preferred_common_name || taxon.name)
      console.log('SpeciesSearch: Filter button - sending', fullSpecies.length, 'species to globe')
      onGlobeSpecies(fullSpecies)
    } catch (error) {
      console.error('Error loading species by confidence:', error)
      setSearchResults([])
      setSearchCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounce utility function
  function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout
    return ((...args: unknown[]) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }) as T
  }

  return (
    <div className="w-full max-w-md lg:w-96 pointer-events-auto relative z-50 min-w-0">
      <div className="space-y-2 sm:space-y-3">
        {/* Conservation Confidence Filter - Mobile Optimized */}
        <div className="relative">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <select
              value={selectedConfidence}
              onChange={(e) => setSelectedConfidence(e.target.value)}
              className="flex-1 py-2.5 px-3 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm min-h-[44px]"
              key="confidence-filter"
            >
              {CONFIDENCE_LEVELS.map((confidence) => (
                <option key={confidence.value} value={confidence.value}>
                  {confidence.label}
                </option>
              ))}
            </select>
            <button
              onClick={loadSpeciesByConfidence}
              disabled={isLoading}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors duration-200 text-sm font-medium min-h-[44px] whitespace-nowrap flex-shrink-0"
            >
              {isLoading ? 'Loading...' : 'Filter'}
            </button>
          </div>
        </div>

        {/* Search Input - Mobile Optimized */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-black/70" />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onBlur={handleInputBlur}
            placeholder="Search animal species..."
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-lg text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm min-h-[44px] text-base"
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {isLoading ? (
              <SpecinateLoader size="sm" />
            ) : (
          <ChevronDown className="h-4 w-4 text-black/70" />
            )}
        </div>
        
        {/* Dropdown - Mobile Optimized */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
            {/* Search count pill */}
            {((searchValue.length >= 2) || hasSearched) && searchCount > 0 && (
              <div className="px-3 sm:px-4 py-2 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">
                    {hasSearched && selectedConfidence !== 'all' 
                      ? `Found ${searchCount} species`
                      : `Found ${searchCount} species`
                    }
                  </span>
                  <div className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                    {searchCount}
                  </div>
                </div>
              </div>
            )}

            {searchResults.length > 0 ? (
              <div className="py-1 sm:py-2">
                {searchResults.map((species) => (
                  <div
                    key={species.id}
                    onClick={() => handleSpeciesSelect(species)}
                    className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-100 cursor-pointer flex items-start gap-2 sm:gap-3 transition-colors duration-150 min-h-[60px] sm:min-h-[70px]"
                  >
                    <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center">
                      {species.photo ? (
                        <Image 
                          src={species.photo} 
                          alt={species.commonName || species.name}
                          width={40}
                          height={40}
                          className="object-cover rounded w-full h-full"
                        />
                      ) : (
                      <div className="text-xs font-medium text-slate-600 text-center">
                        {species.category}
                      </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                        <span className="font-semibold text-slate-800 truncate text-sm sm:text-base">
                          {species.commonName || species.name}
                        </span>
                        <div className="flex flex-wrap gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-1 rounded-full ${inaturalistAPI.getIUCNColor(species.status)}`}>
                          {species.status}
                          </span>
                          <span 
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              species.confidence === 'High' ? 'bg-green-100 text-green-700 border border-green-200' :
                              species.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                              'bg-red-100 text-red-700 border border-red-200'
                            }`}
                            style={{
                              backgroundColor: species.confidence === 'High' ? '#dcfce7' : 
                                             species.confidence === 'Medium' ? '#fef3c7' : '#fee2e2',
                              color: species.confidence === 'High' ? '#15803d' : 
                                     species.confidence === 'Medium' ? '#d97706' : '#dc2626'
                            }}
                          >
                            {species.confidence}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500 truncate">
                          {species.name}
                        </span>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {species.observationsCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchValue.length >= 2 && !isLoading ? (
              <div className="px-4 py-8 text-center text-slate-500">
                <div className="flex flex-col items-center gap-2">
                  <Search className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  <p className="text-sm sm:text-base">No species found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              </div>
            ) : searchValue.length < 2 && !hasSearched ? (
              <div className="px-4 py-8 text-center text-slate-500">
                <div className="flex flex-col items-center gap-2">
                  <Search className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  <p className="text-sm sm:text-base">Type to search species or use confidence filter</p>
                  <p className="text-xs">Enter at least 2 characters or select a confidence level</p>
                </div>
              </div>
            ) : null}
              </div>
            )}
          </div>
      </div>
    </div>
  )
}
