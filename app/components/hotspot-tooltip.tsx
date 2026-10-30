"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import Image from "next/image"
import { Eye, ExternalLink } from "lucide-react"
import { Badge } from "@/app/components/ui/badge"
// import { HOTSPOT_DATA } from "./globe" // Commented out - using only iNaturalist data
import { inaturalistAPI, getStatusBadge, type iNaturalistTaxon } from "@/app/lib/inaturalist"

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
          <div className="w-60 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 relative isolate overflow-hidden" aria-busy="true">
            <div className="h-28 bg-gray-200 animate-pulse" />
            <div className="p-3 animate-pulse">
              <div className="h-4 w-3/4 bg-gray-200 rounded" />
              <div className="h-3 w-1/2 bg-gray-100 rounded mt-1.5" />
              <div className="h-3 w-2/5 bg-gray-100 rounded mt-3" />
              <div className="h-8 w-full bg-gray-100 rounded-lg mt-3" />
            </div>
          </div>
        </TooltipFrame>
      )
    }

    const status = inaturalistAPI.getIUCNStatus(dynamicData)
    const statusBadge = getStatusBadge(status)
    const commonName = dynamicData.preferred_common_name || dynamicData.name
    const photoUrl = dynamicData.default_photo?.medium_url

    return (
      <TooltipFrame>
        <div className="w-60 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 relative isolate overflow-hidden animate-tooltip-content">
          {/* Photo header with status pill */}
          <div className="relative h-28 bg-gray-100">
            {photoUrl && (
              <Image
                src={photoUrl}
                alt={commonName}
                fill
                className="object-cover"
                sizes="240px"
              />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
            <Badge className={`${statusBadge.className} absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm border-0`}>
              {statusBadge.label}
            </Badge>
          </div>

          <div className="p-3">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug truncate" title={commonName}>
              {commonName}
            </h3>
            {dynamicData.preferred_common_name && (
              <p className="text-xs italic text-gray-500 truncate">{dynamicData.name}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600">
              <Eye className="w-3.5 h-3.5 text-gray-400" aria-hidden />
              <span>
                <span className="font-medium text-gray-900">
                  {dynamicData.observations_count?.toLocaleString() || "Unknown"}
                </span>{" "}
                observations
              </span>
            </div>

            <a
              href={`https://www.inaturalist.org/taxa/${dynamicData.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 w-full text-xs font-medium bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors duration-150"
            >
              View on iNaturalist
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </TooltipFrame>
    )
  }

  // No fallback - using only iNaturalist data
  return null
}
