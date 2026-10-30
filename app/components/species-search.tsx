"use client"

import { useState, useEffect, useRef, useId } from "react"
import { Search, X, Loader2 } from "lucide-react"
import Image from "next/image"
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"

interface SpeciesSearchProps {
  onSelectHotspot: (species: iNaturalistTaxon) => void
  onGlobeSpecies: (species: iNaturalistTaxon[]) => void
}

// `value` is passed straight to searchSpecies as comma-separated IUCN codes.
// Colors match the globe markers (getStatusMarkerColor) so each chip doubles as a legend
const STATUS_FILTERS = [
  { value: "all", label: "All", dots: [], selected: "bg-slate-900 text-white border-slate-900" },
  {
    value: "CR,EN,VU",
    label: "Threatened",
    dots: ["bg-red-500", "bg-orange-500", "bg-amber-400"],
    selected: "bg-slate-900 text-white border-slate-900",
  },
  { value: "CR", label: "Critically endangered", dots: ["bg-red-500"], selected: "bg-red-500 text-white border-red-500" },
  { value: "EN", label: "Endangered", dots: ["bg-orange-500"], selected: "bg-orange-500 text-white border-orange-500" },
  { value: "VU", label: "Vulnerable", dots: ["bg-amber-400"], selected: "bg-amber-400 text-amber-950 border-amber-400" },
]

const STATUS_DOTS: Record<string, string> = {
  "Critically Endangered": "bg-red-500",
  Endangered: "bg-orange-500",
  Vulnerable: "bg-amber-400",
  "Near Threatened": "bg-sky-500",
  "Least Concern": "bg-emerald-500",
}

const SEARCH_DELAY = 300
// The list and the globe show the same species, so every result has a marker.
// "Show more" adds this many at a time, up to the 100 a search fetches
const PAGE_SIZE = 20

const compactNumber = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })

export function SpeciesSearch({ onSelectHotspot, onGlobeSpecies }: SpeciesSearchProps) {
  const [query, setQuery] = useState("")
  // Open on threatened species so the globe leads with the animals that need attention
  const [statusFilter, setStatusFilter] = useState("CR,EN,VU")
  const [results, setResults] = useState<iNaturalistTaxon[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const requestId = useRef(0)
  const listboxId = useId()

  // Keep the latest callback without re-running the search when the parent re-renders
  const onGlobeSpeciesRef = useRef(onGlobeSpecies)
  onGlobeSpeciesRef.current = onGlobeSpecies

  const trimmedQuery = query.trim()
  const isQueryTooShort = trimmedQuery.length === 1

  useEffect(() => {
    if (isQueryTooShort) {
      // Cancel any in-flight search; one letter is too broad to be useful
      requestId.current++
      setIsLoading(false)
      return
    }

    const id = ++requestId.current
    setIsLoading(true)
    const timer = setTimeout(async () => {
      try {
        const taxa = await inaturalistAPI.searchSpecies(trimmedQuery, 100, statusFilter)
        // A newer search started while this one was in flight; drop these results
        if (id !== requestId.current) return
        const named = taxa.filter((taxon) => taxon.preferred_common_name || taxon.name)
        setResults(named)
        setActiveIndex(-1)
        setVisibleCount(PAGE_SIZE)
        onGlobeSpeciesRef.current(named.slice(0, PAGE_SIZE))
      } catch (error) {
        if (id === requestId.current) setResults([])
        console.error("Error searching species:", error)
      } finally {
        if (id === requestId.current) setIsLoading(false)
      }
    }, trimmedQuery ? SEARCH_DELAY : 0)

    return () => clearTimeout(timer)
  }, [trimmedQuery, statusFilter, isQueryTooShort])

  // Close when clicking anywhere outside the search
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [isOpen])

  // Keep the keyboard-highlighted option in view
  useEffect(() => {
    if (activeIndex < 0) return
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const visibleResults = results.slice(0, visibleCount)
  const remaining = results.length - visibleResults.length

  const selectSpecies = async (taxon: iNaturalistTaxon) => {
    setIsOpen(false)
    setQuery("")
    inputRef.current?.blur()
    try {
      const fullSpecies = await inaturalistAPI.getSpeciesDetails(taxon.id)
      onSelectHotspot(fullSpecies ?? taxon)
    } catch (error) {
      console.error("Error fetching species details:", error)
      onSelectHotspot(taxon)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setIsOpen(true)
        setActiveIndex((i) => Math.min(i + 1, visibleResults.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        if (isOpen && visibleResults[activeIndex]) {
          e.preventDefault()
          selectSpecies(visibleResults[activeIndex])
        }
        break
      case "Escape":
        if (isOpen) {
          setIsOpen(false)
        } else if (query) {
          setQuery("")
        }
        break
    }
  }

  const showMore = () => {
    const nextCount = Math.min(visibleCount + PAGE_SIZE, results.length)
    setVisibleCount(nextCount)
    // Highlight the first new species so the list scrolls to where the additions start
    setActiveIndex(visibleCount)
    onGlobeSpecies(results.slice(0, nextCount))
  }

  const clearQuery = () => {
    setQuery("")
    inputRef.current?.focus()
    setIsOpen(true)
  }

  // A search fetches at most 100, so a full page of 100 likely means there are more
  const totalLabel = results.length >= 100 ? "100+" : results.length
  const listHeading = trimmedQuery
    ? visibleResults.length < results.length || results.length >= 100
      ? `Showing ${visibleResults.length} of ${totalLabel} for “${trimmedQuery}” · on the globe`
      : `${results.length} ${results.length === 1 ? "result" : "results"} for “${trimmedQuery}” · on the globe`
    : `${visibleResults.length} most observed species · on the globe`

  return (
    <div ref={containerRef} className="w-full lg:w-96 pointer-events-auto relative z-50 min-w-0">
      {/* Search field */}
      <div className="relative">
        {/* The search icon turns into a spinner while results load */}
        {isLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600 animate-spin pointer-events-none" aria-hidden />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-label="Search animal species"
          aria-busy={isLoading}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search animals, e.g. tiger"
          autoComplete="off"
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm min-h-[44px] text-base"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
          {query ? (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Results */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
            {isQueryTooShort ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Keep typing…</p>
            ) : visibleResults.length > 0 ? (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-slate-500">{listHeading}</p>
                <ul
                  ref={listRef}
                  id={listboxId}
                  role="listbox"
                  aria-label="Species"
                  // Keep the previous results visible, dimmed, while new ones load
                  className={`max-h-80 overflow-y-auto pb-1 transition-opacity ${isLoading ? "opacity-50" : ""}`}
                >
                  {visibleResults.map((taxon, index) => {
                    const status = inaturalistAPI.getIUCNStatus(taxon)
                    const dot = STATUS_DOTS[status]
                    const commonName = taxon.preferred_common_name || taxon.name
                    const isActive = index === activeIndex
                    return (
                      <li
                        key={taxon.id}
                        id={`${listboxId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={isActive}
                        // Keep focus in the input so the list doesn't close before the click lands
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSpecies(taxon)}
                        onMouseMove={() => setActiveIndex(index)}
                        className={`flex items-center gap-3 px-3 py-2 mx-1 rounded-lg cursor-pointer ${isActive ? "bg-slate-100" : ""}`}
                      >
                        <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                          {taxon.default_photo?.medium_url && (
                            <Image src={taxon.default_photo.medium_url} alt="" fill sizes="40px" className="object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{commonName}</p>
                          {taxon.preferred_common_name && (
                            <p className="text-xs italic text-slate-500 truncate">{taxon.name}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {dot && (
                            <p className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-700">
                              <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
                              {status}
                            </p>
                          )}
                          {taxon.observations_count ? (
                            <p className="text-[11px] text-slate-400">
                              {compactNumber.format(taxon.observations_count)} sightings
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {remaining > 0 ? (
                  <div className="px-2 py-2 border-t border-gray-100">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={showMore}
                      className="w-full py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Show {Math.min(PAGE_SIZE, remaining)} more
                    </button>
                  </div>
                ) : results.length >= 100 ? (
                  <p className="px-4 py-2 border-t border-gray-100 text-xs text-slate-500">
                    {trimmedQuery ? "Type more of the name" : "Search by name"} or pick a status below to narrow results.
                  </p>
                ) : null}
              </>
            ) : !isLoading ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-700">No species found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {statusFilter !== "all" ? "Try a different name or set the filter to All" : "Try a different name"}
                </p>
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Searching…</p>
            )}
          </div>
        )}
      </div>

      {/* Status filter */}
      <div
        role="radiogroup"
        aria-label="Filter by conservation status"
        className="flex flex-wrap gap-1.5 mt-2"
      >
        {STATUS_FILTERS.map((filter) => {
          const isSelected = statusFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setStatusFilter(filter.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isSelected
                  ? filter.selected
                  : "bg-white text-slate-600 border-gray-200 hover:border-slate-400"
              }`}
            >
              {filter.dots.length > 0 && (
                <span className="flex -space-x-0.5" aria-hidden>
                  {filter.dots.map((dot) => (
                    <span
                      key={dot}
                      // On a chip filled with its own color, outline the dot so it stays visible
                      className={`w-2 h-2 rounded-full ${dot} ${isSelected ? "ring-1 ring-white" : ""}`}
                    />
                  ))}
                </span>
              )}
              {filter.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
