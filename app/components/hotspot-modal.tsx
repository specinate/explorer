"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { X, ExternalLink, AlertTriangle, MapPin, Globe2 } from "lucide-react"
import {
  inaturalistAPI,
  getStatusMarkerColor,
  IUCN_CODE_BY_STATUS,
  type iNaturalistTaxon,
  type iNaturalistObservation,
} from "@/app/lib/inaturalist"

interface HotspotModalProps {
  hotspotId: string | null
  isOpen: boolean
  onClose: () => void
  // What we already know about the species (from search or the globe), shown while the rest loads
  preview?: iNaturalistTaxon | null
  // Closes the profile and turns the globe to this species' marker; omit when it has none
  onShowOnGlobe?: () => void
}

interface SpeciesData {
  taxon: iNaturalistTaxon
  observations: iNaturalistObservation[]
}

const SIGHTINGS_SHOWN = 3
// Some research-grade sightings have no photo, so fetch a few spare
const SIGHTINGS_FETCHED = 6

// Fallback labels for iNaturalist's iconic groups, used when the class has no common name
const GROUP_LABELS: Record<string, string> = {
  Aves: "Birds",
  Mammalia: "Mammals",
  Reptilia: "Reptiles",
  Amphibia: "Amphibians",
  Actinopterygii: "Ray-finned fishes",
  Mollusca: "Mollusks",
  Arachnida: "Arachnids",
  Insecta: "Insects",
}

// The Red List's seven categories, least to most threatened, with what each one means
const RED_LIST = [
  { code: "LC", color: "var(--iucn-lc)", meaning: "Widespread and not at risk of extinction right now." },
  { code: "NT", color: "var(--iucn-nt)", meaning: "Close to being threatened, or likely to be soon." },
  { code: "VU", color: "var(--iucn-vu)", meaning: "Faces a high risk of extinction in the wild." },
  { code: "EN", color: "var(--iucn-en)", meaning: "Faces a very high risk of extinction in the wild." },
  { code: "CR", color: "var(--iucn-cr)", meaning: "Faces an extremely high risk of extinction in the wild." },
  { code: "EW", color: "#5b3a6e", meaning: "Survives only in captivity or outside its natural range." },
  { code: "EX", color: "#1b1b1b", meaning: "No individuals are known to survive." },
]
const UNRATED_MEANING: Record<string, string> = {
  DD: "There isn't enough data yet to judge its risk of extinction.",
  NE: "No conservation assessment is on file for this species yet.",
}

// Wikipedia summaries come back with inline HTML (<b>, <i>, etc.)
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim()

// iNaturalist observation photo URLs point at the 75px square; swap for a usable size
const mediumPhoto = (url: string) => url.replace("/square.", "/medium.")

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })

// "(c) Luis P. B., some rights reserved (CC BY-NC), uploaded by Luis P. B." -> "© Luis P. B. (CC BY-NC)"
const shortCredit = (attribution: string) =>
  attribution
    .replace(/,\s*uploaded by .*$/i, "")
    .replace(/,\s*(some|all) rights reserved/i, "")
    .replace(/^\(c\)/i, "©")
    .trim()

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// A useful group name: the class's common name ("Sharks and Rays"), else the iconic group.
// "Animalia" says nothing, so it is dropped.
function groupLabel(taxon: iNaturalistTaxon): string | null {
  const taxonClass = taxon.ancestors?.find((a) => a.rank === "class")
  if (taxonClass?.preferred_common_name) return capitalize(taxonClass.preferred_common_name)
  const iconic = taxon.iconic_taxon_name
  if (!iconic || iconic === "Animalia") return taxonClass?.name ?? null
  return GROUP_LABELS[iconic] ?? iconic
}

// Placeholder the same size as the content it stands in for, so nothing shifts when data arrives
// (`paper` for ones on the pale specimen label)
function Bone({ className = "", paper = false }: { className?: string; paper?: boolean }) {
  return <span className={`${paper ? "skeleton-bone-paper" : "skeleton-bone"} block rounded ${className}`} aria-hidden />
}

function RedListScale({ taxon }: { taxon: iNaturalistTaxon }) {
  const status = inaturalistAPI.getIUCNStatus(taxon)
  const code = IUCN_CODE_BY_STATUS[status] ?? "NE"
  const index = RED_LIST.findIndex((c) => c.code === code)
  const meaning = index >= 0 ? RED_LIST[index].meaning : UNRATED_MEANING[code] ?? UNRATED_MEANING.NE
  const cs = taxon.conservation_status
  const source = cs?.authority
    ? `Assessed by ${cs.authority}, ${cs.place?.name ?? "worldwide"}`
    : null

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">IUCN Red List</h3>
      <ol
        className="grid grid-cols-7 gap-[3px]"
        aria-label={index >= 0 ? `${status}: category ${index + 1} of 7, from Least Concern to Extinct` : status}
      >
        {RED_LIST.map((c, i) => {
          const on = i === index
          return (
            <li key={c.code} className="flex flex-col items-center gap-1.5" aria-current={on || undefined}>
              <span
                className={`block w-full rounded-[2px] ${c.code === "EX" ? "border border-white/20" : ""} ${
                  on ? "h-2.5 -mt-1 ring-2 ring-deep outline outline-1 outline-frost" : "h-1.5 opacity-35"
                }`}
                style={{ background: c.color }}
                aria-hidden
              />
              <span className={`font-mono text-[10px] ${on ? "font-medium text-frost" : "text-mist"}`}>{c.code}</span>
            </li>
          )
        })}
      </ol>
      <p className="mt-2.5 text-sm text-frost/90">
        <b className="font-semibold text-frost">{status === "Not Evaluated" ? "Not assessed." : `${status}.`}</b> {meaning}
      </p>
      {source && <p className="mt-0.5 text-xs text-mist">{source}</p>}
    </div>
  )
}

export function HotspotModal({ hotspotId, isOpen, onClose, preview, onShowOnGlobe }: HotspotModalProps) {
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null)
  const [failedId, setFailedId] = useState<number | null>(null)

  const taxonId = hotspotId?.startsWith("dynamic-") ? Number(hotspotId.replace("dynamic-", "")) : null

  useEffect(() => {
    if (!isOpen || taxonId == null) return
    // Ignore a slow response for a species the user has already moved on from
    let cancelled = false

    Promise.all([
      inaturalistAPI.getSpeciesDetails(taxonId),
      inaturalistAPI.getSpeciesObservations(taxonId, SIGHTINGS_FETCHED),
    ]).then(([taxon, observations]) => {
      if (cancelled) return
      if (taxon) setSpeciesData({ taxon, observations })
      else setFailedId(taxonId)
    }).catch(error => {
      console.error('Error loading species data:', error)
      if (!cancelled) setFailedId(taxonId)
    })

    return () => {
      cancelled = true
    }
  }, [isOpen, taxonId])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || taxonId == null) return null

  const backdrop = "fixed inset-0 bg-night/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-4"

  const isLoaded = speciesData?.taxon.id === taxonId
  const hasFailed = !isLoaded && failedId === taxonId
  const isLoading = !isLoaded && !hasFailed

  if (hasFailed) {
    return (
      <div className={backdrop} onClick={onClose}>
        <div className="bg-deep border border-rule rounded-2xl shadow-2xl p-8 max-w-md text-center text-frost" onClick={(e) => e.stopPropagation()}>
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold mb-2">Species Data Not Available</h3>
          <p className="text-mist mb-4">
            Unable to load detailed information for this species at the moment.
          </p>
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </div>
    )
  }

  // While loading, show whatever the search/globe already told us about this species
  const taxon = isLoaded ? speciesData.taxon : preview?.id === taxonId ? preview : null
  const commonName = taxon ? taxon.preferred_common_name || taxon.name : null
  const status = taxon ? inaturalistAPI.getIUCNStatus(taxon) : null
  const code = status ? IUCN_CODE_BY_STATUS[status] : null
  const codeDarkText = code === "EN" || code === "VU" || code === "NT" || code === "LC"
  // Group needs the full record (its ancestors), so wait for it rather than flash a vaguer label
  const group = isLoaded ? groupLabel(speciesData.taxon) : null
  const summary = isLoaded && speciesData.taxon.wikipedia_summary ? stripHtml(speciesData.taxon.wikipedia_summary) : null

  const observations = isLoaded
    ? [...speciesData.observations].sort((a, b) => (b.observed_on ?? "").localeCompare(a.observed_on ?? ""))
    : []
  const lastSeen = observations.find((obs) => obs.observed_on)?.observed_on
  const sightings = observations.filter((obs) => obs.photos?.length).slice(0, SIGHTINGS_SHOWN)
  const photoUrl = taxon?.default_photo?.medium_url
  const photoCredit = taxon?.default_photo?.attribution
  const inatUrl = `https://www.inaturalist.org/taxa/${taxonId}`

  const factLabel = "text-[9.5px] font-semibold uppercase tracking-[0.14em] opacity-60"
  const factValue = "font-mono text-[13px] tabular-nums whitespace-nowrap"

  return (
    <div className={backdrop} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={commonName ?? "Species profile"}
        aria-busy={isLoading}
        className="relative bg-deep text-frost border border-rule rounded-2xl shadow-2xl shadow-black/60 max-w-xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo */}
        <div className="relative h-52 sm:h-64 bg-night">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={commonName ?? ""}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            isLoading && <Bone className="absolute inset-0 rounded-none" />
          )}
          {photoUrl && photoCredit && (
            <p
              className="absolute left-3 top-3 max-w-[70%] truncate rounded bg-night/60 px-2 py-0.5 text-[10.5px] text-frost/90 backdrop-blur-sm"
              title={photoCredit}
            >
              {shortCredit(photoCredit)}
            </p>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-night/60 text-frost hover:bg-night/80 backdrop-blur-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Specimen label, pinned over the photo's lower edge like a museum tag */}
        <div className="relative z-10 -mt-12 mx-3.5 sm:mx-5 rounded-[6px_6px_6px_18px] bg-lichen text-tag-ink px-4 pt-3.5 pb-3 shadow-[0_16px_30px_-14px_#000]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {commonName ? (
                <h2 className="font-display text-[23px] sm:text-[26px] font-extrabold leading-[1.08] tracking-tight">{commonName}</h2>
              ) : (
                <Bone paper className="h-7 w-48 my-0.5" />
              )}
              {taxon ? (
                taxon.preferred_common_name && <p className="mt-0.5 text-[13.5px] italic opacity-75">{taxon.name}</p>
              ) : (
                <Bone paper className="h-3.5 w-32 mt-1.5" />
              )}
            </div>
            {status && (
              <span
                className="mt-1 shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-medium"
                style={{ background: getStatusMarkerColor(status), color: codeDarkText ? "#1a1a1a" : "#fff" }}
                title={status}
              >
                {code && code !== "NE" ? code : "NE"}
              </span>
            )}
          </div>

          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-tag-ink/15 pt-2.5">
            {(group || isLoading) && (
              <div>
                <dt className={factLabel}>Group</dt>
                <dd className={factValue}>{group ?? <Bone paper className="h-4 w-20 my-0.5" />}</dd>
              </div>
            )}
            <div>
              <dt className={factLabel}>Sightings</dt>
              <dd className={factValue}>
                {taxon ? taxon.observations_count?.toLocaleString() || "Unknown" : <Bone paper className="h-4 w-14 my-0.5" />}
              </dd>
            </div>
            {(lastSeen || isLoading) && (
              <div>
                <dt className={factLabel}>Last seen</dt>
                <dd className={factValue}>{lastSeen ? formatDate(lastSeen) : <Bone paper className="h-4 w-24 my-0.5" />}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="px-4 sm:px-5 pt-5 pb-4 space-y-6">
          {/* Red List scale: says what the status means, not just its name */}
          {taxon ? (
            <RedListScale taxon={taxon} />
          ) : (
            <div aria-hidden className="space-y-2.5">
              <Bone className="h-3 w-24" />
              <Bone className="h-2 w-full" />
              <Bone className="h-3.5 w-4/5" />
            </div>
          )}

          {/* About */}
          {isLoading ? (
            <div className="space-y-2.5 py-0.5" aria-hidden>
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-[94%]" />
              <Bone className="h-3 w-3/5" />
            </div>
          ) : summary && (
            <div className="animate-tooltip-content">
              <p className="text-sm text-frost/85 leading-relaxed line-clamp-3">{summary}</p>
              {speciesData?.taxon.wikipedia_url && (
                <a
                  href={speciesData.taxon.wikipedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs font-medium text-frost underline-offset-2 hover:underline"
                >
                  Read more on Wikipedia
                </a>
              )}
            </div>
          )}

          {/* Recent sightings: three, newest first, in one row */}
          {(isLoading || sightings.length > 0) && (
            <div className={isLoading ? undefined : "animate-tooltip-content"}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">Recent sightings</h3>
                {!isLoading && (
                  <a
                    href={`https://www.inaturalist.org/observations?taxon_id=${taxonId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium text-frost underline-offset-2 hover:underline"
                  >
                    See all
                    <ExternalLink className="w-3 h-3" aria-hidden />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {isLoading
                  ? Array.from({ length: SIGHTINGS_SHOWN }, (_, i) => <Bone key={i} className="aspect-square rounded-lg" />)
                  : sightings.map((obs) => (
                      <a
                        key={obs.id}
                        href={`https://www.inaturalist.org/observations/${obs.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative aspect-square rounded-lg overflow-hidden bg-night"
                      >
                        <img
                          src={mediumPhoto(obs.photos![0].url)}
                          alt={obs.place_guess ? `Sighting in ${obs.place_guess}` : "Sighting"}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 to-transparent p-1.5 pt-6 text-white">
                          {obs.place_guess && (
                            <p className="flex items-center gap-0.5 text-[10.5px] font-medium">
                              <MapPin className="w-2.5 h-2.5 shrink-0" aria-hidden />
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
        </div>

        {/* Actions stay in reach while the profile scrolls */}
        <div className="sticky bottom-0 flex gap-2 px-4 sm:px-5 pt-3 pb-4 bg-linear-to-t from-deep from-70% to-transparent">
          {onShowOnGlobe && (
            <button
              type="button"
              onClick={onShowOnGlobe}
              className="flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-lichen px-4 text-sm font-semibold text-tag-ink hover:brightness-105"
            >
              <Globe2 className="w-4 h-4" aria-hidden />
              Show on globe
            </button>
          )}
          <a
            href={inatUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${onShowOnGlobe ? "" : "flex-1"} inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-rule px-4 text-sm font-semibold text-frost hover:bg-frost/5`}
          >
            iNaturalist
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </div>
  )
}
