"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import Image from "next/image"
import { ExternalLink } from "lucide-react"
// import { HOTSPOT_DATA } from "./globe" // Commented out - using only iNaturalist data
import { inaturalistAPI, getStatusMarkerColor, IUCN_CODE_BY_STATUS, type iNaturalistTaxon } from "@/app/lib/inaturalist"

interface HotspotTooltipProps {
  hotspotId: string
}

const GAP = 14 // space between marker and card
const EDGE = 8 // minimum space between card and the globe area's edges

// Rendered at the marker's screen point (the <Html> anchor). Puts the card above the
// marker, flips it below when there's no room, and clamps it inside the globe area —
// the canvas wrapper clips overflow, so anything past its edge gets cut off.
function TooltipFrame({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState<{ x: number; y: number; below: boolean } | null>(null)

  useEffect(() => {
    let frame = 0
    // The marker moves as the globe rotates, so keep re-measuring while visible
    const place = () => {
      const anchorEl = anchorRef.current
      const card = cardRef.current
      if (anchorEl && card) {
        const anchor = anchorEl.getBoundingClientRect()
        const bounds = anchorEl.closest(".globe-container")?.getBoundingClientRect()
          ?? { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
        const w = card.offsetWidth
        const h = card.offsetHeight

        const roomAbove = anchor.top - bounds.top
        const roomBelow = bounds.bottom - anchor.top
        const below = roomAbove < h + GAP + EDGE && roomBelow > roomAbove
        let top = below ? anchor.top + GAP : anchor.top - GAP - h
        top = Math.min(Math.max(top, bounds.top + EDGE), bounds.bottom - EDGE - h)
        let left = anchor.left - w / 2
        left = Math.min(Math.max(left, bounds.left + EDGE), bounds.right - EDGE - w)

        const x = Math.round(left - anchor.left)
        const y = Math.round(top - anchor.top)
        setOffset((prev) => (prev && prev.x === x && prev.y === y && prev.below === below ? prev : { x, y, below }))
      }
      frame = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div ref={anchorRef} className="relative z-[99999] w-0 h-0">
      <div
        ref={cardRef}
        className="pointer-events-auto absolute transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        style={{
          left: offset?.x ?? 0,
          top: offset?.y ?? 0,
          opacity: offset ? 1 : 0,
          transform: offset ? "none" : "scale(0.96)",
          transformOrigin: offset?.below ? "top center" : "bottom center",
        }}
      >
        {children}
      </div>
    </div>
  )
}


export function HotspotTooltip({ hotspotId }: HotspotTooltipProps) {
  const [dynamicData, setDynamicData] = useState<iNaturalistTaxon | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    if (hotspotId.startsWith('dynamic-')) {
      setIsLoading(true)
      setImageLoaded(false)
      const taxonId = parseInt(hotspotId.replace('dynamic-', ''))
      
      inaturalistAPI.getSpeciesDetails(taxonId).then(taxon => {
        setDynamicData(taxon)
        
        // Preload the image before showing the card
        if (taxon?.default_photo?.medium_url) {
          const img = new window.Image()
          img.onload = () => {
            setImageLoaded(true)
            setIsLoading(false)
          }
          img.onerror = () => {
            setImageLoaded(true) // Still show the card even if image fails
            setIsLoading(false)
          }
          img.src = taxon.default_photo.medium_url
        } else {
          // No image available, show card immediately
          setImageLoaded(true)
          setIsLoading(false)
        }
      }).catch(error => {
        console.error('Error loading tooltip data:', error)
        setIsLoading(false)
      })
    } else {
      setDynamicData(null)
      setImageLoaded(false)
    }
  }, [hotspotId])

  // For dynamic hotspots, use iNaturalist data
  if (hotspotId.startsWith('dynamic-')) {
    if (isLoading || !dynamicData || !imageLoaded) {
      return (
        <TooltipFrame>
          <div className="w-64 rounded-[6px_6px_6px_16px] bg-lichen p-2.5 shadow-[0_14px_30px_-12px_#000]" aria-busy="true">
            <div className="flex gap-3 animate-pulse">
              <div className="w-14 h-14 shrink-0 rounded-md bg-tag-ink/10" />
              <div className="flex-1 pt-1">
                <div className="h-3.5 w-4/5 rounded bg-tag-ink/15" />
                <div className="h-3 w-3/5 rounded bg-tag-ink/10 mt-1.5" />
                <div className="h-4 w-2/5 rounded bg-tag-ink/10 mt-2" />
              </div>
            </div>
          </div>
        </TooltipFrame>
      )
    }

    const status = inaturalistAPI.getIUCNStatus(dynamicData)
    const code = IUCN_CODE_BY_STATUS[status]
    const color = getStatusMarkerColor(status)
    const darkText = code === "EN" || code === "VU" || code === "NT" || code === "LC"
    const commonName = dynamicData.preferred_common_name || dynamicData.name
    const photoUrl = dynamicData.default_photo?.medium_url

    return (
      <TooltipFrame>
        {/* A small specimen label, matching the species card */}
        <a
          href={`https://www.inaturalist.org/taxa/${dynamicData.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group block w-64 rounded-[6px_6px_6px_16px] bg-lichen p-2.5 text-tag-ink shadow-[0_14px_30px_-12px_#000] animate-tooltip-content"
        >
          <div className="flex gap-3">
            <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-md bg-tag-ink/10">
              {photoUrl && <Image src={photoUrl} alt="" fill className="object-cover" sizes="56px" />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[15px] font-extrabold leading-tight tracking-tight truncate" title={commonName}>
                {commonName}
              </h3>
              {dynamicData.preferred_common_name && (
                <p className="text-xs italic opacity-75 truncate">{dynamicData.name}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-px font-mono text-[10.5px] font-medium"
                  style={{ background: color, color: darkText ? "#1a1a1a" : "#fff" }}
                  title={status}
                >
                  {code && code !== "NE" ? code : "NE"}
                </span>
                <span className="font-mono text-[11px] tabular-nums opacity-70">
                  {dynamicData.observations_count?.toLocaleString() ?? "?"} sightings
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-tag-ink/15 pt-1.5 text-[11px] font-semibold">
            <span className="opacity-70">{status === "Not Evaluated" ? "Not yet assessed" : status}</span>
            <span className="flex items-center gap-1 group-hover:underline">
              iNaturalist
              <ExternalLink className="w-3 h-3" aria-hidden />
            </span>
          </div>
        </a>
      </TooltipFrame>
    )
  }

  // No fallback - using only iNaturalist data
  return null
}
