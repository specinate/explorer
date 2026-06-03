"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { SpecinateLoader } from "@/app/components/specinate-loader"
// import { HOTSPOT_DATA } from "./globe" // Commented out - using only iNaturalist data
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"

interface HotspotTooltipProps {
  hotspotId: string
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
        <div className="pointer-events-auto relative z-[99999]" style={{ transform: "translate(-50%, -50%)" }}>
          <div className="bg-white border border-gray-200 shadow-2xl rounded-lg relative isolate overflow-hidden max-w-56">
            {/* Arrow pointing down to marker */}
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
            
            <div className="p-2">
              <SpecinateLoader size="sm" text="Loading..." />
            </div>
          </div>
        </div>
      )
    }

    const status = inaturalistAPI.getIUCNStatus(dynamicData)
    const urgency = inaturalistAPI.getConservationPriority(status)
    const urgencyColors = {
      critical: "bg-red-100 text-red-700",
      high: "bg-orange-100 text-orange-700", 
      moderate: "bg-yellow-100 text-yellow-700",
      low: "bg-blue-100 text-blue-700"
    }

    return (
      <div className="pointer-events-auto relative z-[99999]" style={{ transform: "translate(-50%, -50%)" }}>
        <div className="bg-white border border-gray-200 shadow-2xl rounded-lg relative isolate overflow-hidden max-w-56">
          {/* Arrow pointing down to marker */}
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45"></div>
          
          <div className="p-2">
            <div className="flex items-center gap-2">
              {/* Thumbnail Image */}
              {dynamicData.default_photo?.medium_url && (
                <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0 relative">
                  <Image 
                    src={dynamicData.default_photo.medium_url} 
                    alt={dynamicData.preferred_common_name || dynamicData.name}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              )}
              
              {/* Species Name and Badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-0.5">
                  <Badge className={`${urgencyColors[urgency]} text-xs px-1 py-0.5 text-[10px]`}>{urgency.toUpperCase()}</Badge>
                </div>
                <h3 className="font-bold text-gray-900 text-xs leading-tight">
                  {dynamicData.preferred_common_name || dynamicData.name}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {dynamicData.observations_count?.toLocaleString() || 'Unknown'} obs
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => window.open(`https://www.inaturalist.org/taxa/${dynamicData.id}`, '_blank')}
              className="w-full text-[10px] bg-blue-600 text-white py-1 px-2 rounded hover:bg-blue-700 transition-colors duration-150 font-medium mt-1.5"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No fallback - using only iNaturalist data
  return null
}
