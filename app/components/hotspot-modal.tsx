"use client"

import { useState, useEffect } from "react"
import { Card } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { X, ExternalLink, MapPin, Users, AlertTriangle } from "lucide-react"
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"
import { SpecinateLoader } from "@/app/components/specinate-loader"
// import { HOTSPOT_DATA } from "./globe" // Commented out - using only iNaturalist data

interface HotspotModalProps {
  hotspotId: string | null
  isOpen: boolean
  onClose: () => void
}

interface SpeciesData {
  taxon: iNaturalistTaxon
  observations: any[]
  threats: any[]
}

const getUrgencyColors = (urgency: string) => {
  switch (urgency) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'moderate': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const animalCategories: Record<string, string> = {
  "Sumatran Orangutan": "Primate",
  "Sumatran Tiger": "Big Cat",
  "Sumatran Elephant": "Mammal",
  "Javan Rhino": "Mammal",
  "Mountain Gorilla": "Primate",
  "African Forest Elephant": "Mammal",
  Okapi: "Mammal",
  "Giant Panda": "Mammal",
  "Snow Leopard": "Big Cat",
  "Red Panda": "Mammal",
  "Amur Leopard": "Big Cat",
  "Siberian Tiger": "Big Cat",
  "Baikal Seal": "Mammal",
  Vaquita: "Marine Mammal",
  Totoaba: "Fish",
  "California Condor": "Bird",
  "Hawksbill Turtle": "Reptile",
  "Leatherback Turtle": "Reptile",
  "Caribbean Monk Seal": "Marine Mammal",
  Jaguar: "Big Cat",
  "Harpy Eagle": "Bird",
  "Poison Dart Frog": "Amphibian",
  Kakapo: "Bird",
  Kiwi: "Bird",
  "Yellow-eyed Penguin": "Bird",
}

export function HotspotModal({ hotspotId, isOpen, onClose }: HotspotModalProps) {
  const [speciesData, setSpeciesData] = useState<SpeciesData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && hotspotId && hotspotId.startsWith('dynamic-')) {
      setIsLoading(true)
      setSpeciesData(null) // Reset previous data
      const taxonId = parseInt(hotspotId.replace('dynamic-', ''))
      
      console.log('Loading species data for taxon ID:', taxonId)
      
      Promise.all([
        inaturalistAPI.getSpeciesDetails(taxonId),
        inaturalistAPI.getSpeciesObservations(taxonId, 2), // Only 2 most recent observations
        inaturalistAPI.getSpeciesThreats(taxonId)
      ]).then(([taxon, observations, threats]) => {
        console.log('Species data loaded:', { taxon, observations, threats })
        if (taxon) {
          setSpeciesData({ taxon, observations, threats })
        } else {
          console.warn('No taxon data received')
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

  if (!isOpen || !hotspotId) return null

  // For dynamic hotspots, use iNaturalist data
  if (hotspotId.startsWith('dynamic-')) {
    if (isLoading) {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <SpecinateLoader size="md" text="Loading species data..." />
          </div>
        </div>
      )
    }

    if (!speciesData) {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Species Data Not Available</h3>
              <p className="text-gray-600 mb-4">
                Unable to load detailed information for this species at the moment.
              </p>
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      )
    }

    const { taxon, observations } = speciesData
    const status = inaturalistAPI.getIUCNStatus(taxon)
    const urgency = inaturalistAPI.getConservationPriority(status)

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[99999] flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          {/* Header - Mobile Optimized */}
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <Badge className={`${getUrgencyColors(urgency)} text-xs sm:text-sm font-medium`}>
                    {urgency.toUpperCase()}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Global Distribution</span>
                  </div>
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-1 sm:mb-2 truncate">
                  {taxon.preferred_common_name || taxon.name}
                </h2>
                <p className="text-sm sm:text-base text-gray-600">
                  {taxon.name} • {taxon.observations_count?.toLocaleString() || 0} observations
                </p>
              </div>
              
              {/* Species Image */}
              {taxon.default_photo?.medium_url && (
                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={taxon.default_photo.medium_url} 
                    alt={taxon.preferred_common_name || taxon.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
              
              <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 sm:p-2">
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>

          {/* Content - Mobile Optimized */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Species Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Species Information
              </h3>
              <div className="grid gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">Conservation Status</h4>
                    <Badge className={`${inaturalistAPI.getIUCNColor(status)}`}>
                      {status}
                    </Badge>
                  </div>
                  
                  {/* Conservation Confidence */}
                  {(() => {
                    const confidence = inaturalistAPI.getConservationConfidence(taxon);
                    const confidenceColor = confidence.level === 'High' ? 'text-green-600' : 
                                          confidence.level === 'Medium' ? 'text-yellow-600' : 'text-red-600';
                    return (
                      <div className="mb-2">
                        <span className="text-sm text-gray-600">Confidence: </span>
                        <span className={`text-sm font-medium ${confidenceColor}`}>
                          {confidence.level}
                        </span>
                      </div>
                    );
                  })()}
                  
                  <p className="text-sm text-gray-600 mb-2">
                    Observation Count: {taxon.observations_count?.toLocaleString() || 'Unknown'}
                  </p>
                  
                  {/* IUCN Coverage Gap Explanation */}
                  <div className="text-xs text-gray-500 bg-white p-2 rounded border">
                    <strong>Note:</strong> {inaturalistAPI.getConservationExplanation(taxon)}
                  </div>
                </div>
              </div>
            </div>

            {/* Threats */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Threats & Conservation Challenges
              </h3>
              
              <div className="space-y-3">
                {/* Formal Threats from IUCN Data */}
                {speciesData.threats && speciesData.threats.length > 0 && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">Documented Threats</h4>
                    <div className="space-y-2">
                      {speciesData.threats.map((threat, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${inaturalistAPI.getThreatSeverityColor(threat.severity)}`}>
                            {threat.severity}
                          </span>
                          <span className="text-sm text-red-700">{threat.description || threat.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inferred Threats */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">Potential Threats</h4>
                  <div className="space-y-2">
                    {inaturalistAPI.getInferredThreats(taxon).map((threat, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                          inferred
                        </span>
                        <span className="text-sm text-yellow-700">{threat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conservation Actions */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">How You Can Help</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Report sightings to help track populations</li>
                    <li>• Support habitat conservation efforts</li>
                    <li>• Reduce your environmental footprint</li>
                    <li>• Educate others about species conservation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Recent Observations */}
            {observations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Recent Observations</h3>
                <div className="space-y-3">
                  {observations.map((obs, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      {/* Observation Photo */}
                      {obs.photos && obs.photos.length > 0 && (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                          <img 
                            src={obs.photos[0].url} 
                            alt={`Observation ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          {obs.place_guess || 'Unknown location'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(obs.observed_on).toLocaleDateString()}
                        </p>
                        {obs.user && (
                          <p className="text-xs text-gray-400">
                            by {obs.user.login}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        <div className={`px-2 py-1 rounded-full ${
                          obs.quality_grade === 'research' ? 'bg-green-100 text-green-700' :
                          obs.quality_grade === 'needs_id' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {obs.quality_grade}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
              <Button 
                onClick={() => window.open(`https://www.inaturalist.org/taxa/${taxon.id}`, '_blank')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on iNaturalist
              </Button>
              {taxon.wikipedia_url && (
                <Button 
                  onClick={() => window.open(taxon.wikipedia_url, '_blank')}
                  variant="outline"
                  className="flex-1"
                >
                  Learn More
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No fallback - using only iNaturalist data
  return null
}
