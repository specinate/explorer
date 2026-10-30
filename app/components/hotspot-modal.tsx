"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { X, ExternalLink, AlertTriangle, MapPin } from "lucide-react"
import { inaturalistAPI, getStatusBadge, type iNaturalistTaxon, type iNaturalistObservation } from "@/app/lib/inaturalist"
import { SpecinateLoader } from "@/app/components/specinate-loader"

interface HotspotModalProps {
  hotspotId: string | null
  isOpen: boolean
  onClose: () => void
}

interface SpeciesData {
  taxon: iNaturalistTaxon
  observations: iNaturalistObservation[]
}

const GROUP_LABELS: Record<string, string> = {
  Aves: "Bird",
  Mammalia: "Mammal",
  Reptilia: "Reptile",
  Amphibia: "Amphibian",
  Actinopterygii: "Fish",
  Mollusca: "Mollusk",
  Arachnida: "Arachnid",
  Insecta: "Insect",
}

// Wikipedia summaries come back with inline HTML (<b>, <i>, etc.)
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim()

// iNaturalist observation photo URLs point at the 75px square; swap for a usable size
const mediumPhoto = (url: string) => url.replace("/square.", "/medium.")

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

export function HotspotModal({ hotspotId, isOpen, onClose }: HotspotModalProps) {
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && hotspotId && hotspotId.startsWith('dynamic-')) {
      setIsLoading(true)
      setSpeciesData(null)
      const taxonId = parseInt(hotspotId.replace('dynamic-', ''))

      Promise.all([
        inaturalistAPI.getSpeciesDetails(taxonId),
        inaturalistAPI.getSpeciesObservations(taxonId, 6),
      ]).then(([taxon, observations]) => {
        if (taxon) {
          setSpeciesData({ taxon, observations })
        }
        setIsLoading(false)
      }).catch(error => {
        console.error('Error loading species data:', error)
        setIsLoading(false)
      })
    } else {
      setSpeciesData(null)
    }
  }, [isOpen, hotspotId])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !hotspotId || !hotspotId.startsWith('dynamic-')) return null

  const backdrop = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-4"

  if (isLoading) {
    return (
      <div className={backdrop}>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <SpecinateLoader size="md" text="Loading species data..." />
        </div>
      </div>
    )
  }

  if (!speciesData) {
    return (
      <div className={backdrop} onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center" onClick={(e) => e.stopPropagation()}>
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Species Data Not Available</h3>
          <p className="text-gray-600 mb-4">
            Unable to load detailed information for this species at the moment.
          </p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </div>
    )
  }

  const { taxon, observations } = speciesData
  const commonName = taxon.preferred_common_name || taxon.name
  const status = inaturalistAPI.getIUCNStatus(taxon)
  const statusBadge = getStatusBadge(status)
  const group = taxon.iconic_taxon_name ? GROUP_LABELS[taxon.iconic_taxon_name] || taxon.iconic_taxon_name : null
  const summary = taxon.wikipedia_summary ? stripHtml(taxon.wikipedia_summary) : null
  const sightings = observations.filter((obs) => obs.photos?.length).slice(0, 6)

  return (
    <div className={backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={commonName}
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero */}
        <div className="relative h-56 sm:h-72 bg-gray-200">
          {taxon.default_photo?.medium_url && (
            <img
              src={taxon.default_photo.medium_url}
              alt={commonName}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 backdrop-blur-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white">
            <span className={`${statusBadge.className} inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold mb-2`}>
              {statusBadge.label}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">{commonName}</h2>
            {taxon.preferred_common_name && (
              <p className="text-sm italic text-white/80">{taxon.name}</p>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          {/* Quick facts */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {group && (
              <div>
                <div className="text-xs text-gray-500">Group</div>
                <div className="font-semibold text-gray-900">{group}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500">Observations</div>
              <div className="font-semibold text-gray-900">{taxon.observations_count?.toLocaleString() || "Unknown"}</div>
            </div>
            {sightings[0]?.observed_on && (
              <div>
                <div className="text-xs text-gray-500">Last seen</div>
                <div className="font-semibold text-gray-900">{formatDate(sightings[0].observed_on)}</div>
              </div>
            )}
          </div>

          {/* About */}
          {summary && (
            <div>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-5">{summary}</p>
              {taxon.wikipedia_url && (
                <a
                  href={taxon.wikipedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Read more on Wikipedia
                </a>
              )}
            </div>
          )}

          {/* Recent sightings */}
          {sightings.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Recent sightings</h3>
                <a
                  href={`https://www.inaturalist.org/taxa/${taxon.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  See all on iNaturalist
                  <ExternalLink className="w-3 h-3" aria-hidden />
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sightings.map((obs) => (
                  <a
                    key={obs.id}
                    href={`https://www.inaturalist.org/observations/${obs.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      src={mediumPhoto(obs.photos![0].url)}
                      alt={obs.place_guess ? `Sighting in ${obs.place_guess}` : "Sighting"}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent p-2 pt-6 text-white">
                      {obs.place_guess && (
                        <p className="flex items-center gap-1 text-[11px] font-medium truncate">
                          <MapPin className="w-3 h-3 shrink-0" aria-hidden />
                          <span className="truncate">{obs.place_guess}</span>
                        </p>
                      )}
                      {obs.observed_on && (
                        <p className="text-[10px] text-white/75">{formatDate(obs.observed_on)}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Only needed when there are no sightings to carry the iNaturalist link */}
          {sightings.length === 0 && (
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <a href={`https://www.inaturalist.org/taxa/${taxon.id}`} target="_blank" rel="noopener noreferrer">
                View on iNaturalist
                <ExternalLink className="w-4 h-4 ml-1.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
