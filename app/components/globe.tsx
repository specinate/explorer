"use client"

import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere, Html } from "@react-three/drei"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import { Hotspot } from "./hotspot"
import { HotspotTooltip } from "./hotspot-tooltip"
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"

// Commented out static hotspots - now using only iNaturalist data
/*
export const HOTSPOTS = [
  {
    id: "amazon",
    name: "Amazon Rainforest",
    position: [-1.2, -0.3, 1.5],
    urgency: "critical",
    species: "Jaguar, Poison Dart Frog",
  },
  { id: "madagascar", name: "Madagascar", position: [1.3, -0.8, 0.8], urgency: "critical", species: "Lemurs, Fossa" },
  { id: "borneo", name: "Borneo", position: [1.8, 0.2, 0.5], urgency: "high", species: "Orangutan, Pygmy Elephant" },
  {
    id: "galapagos",
    name: "Galápagos Islands",
    position: [-1.5, -0.1, 1.2],
    urgency: "moderate",
    species: "Giant Tortoise, Marine Iguana",
  },
  {
    id: "congo",
    name: "Congo Basin",
    position: [0.8, -0.2, 1.5],
    urgency: "critical",
    species: "Mountain Gorilla, Okapi",
  },
  { id: "arctic", name: "Arctic Circle", position: [0, 1.8, 0.5], urgency: "high", species: "Polar Bear, Arctic Fox" },
  {
    id: "coral-triangle",
    name: "Coral Triangle",
    position: [1.7, -0.5, 0.8],
    urgency: "critical",
    species: "Sea Turtles, Reef Sharks",
  },
  {
    id: "himalayas",
    name: "Himalayas",
    position: [1.2, 0.8, 1.0],
    urgency: "high",
    species: "Snow Leopard, Red Panda",
  },
]
*/

export const HOTSPOT_DATA: Record<
  string,
  {
    name: string
    region: string
    urgency: "critical" | "high" | "moderate"
    species: Array<{ name: string; population: string; status: string }>
    threats: string[]
    opportunities: string
  }
> = {
  amazon: {
    name: "Amazon Rainforest",
    region: "South America",
    urgency: "critical",
    species: [
      { name: "Jaguar", population: "~64,000", status: "Near Threatened" },
      { name: "Poison Dart Frog", population: "Unknown", status: "Vulnerable" },
      { name: "Harpy Eagle", population: "~50,000", status: "Near Threatened" },
    ],
    threats: ["Deforestation", "Climate change", "Illegal hunting"],
    opportunities: "Support reforestation projects and indigenous land rights to protect 10% of Earth's biodiversity.",
  },
  madagascar: {
    name: "Madagascar",
    region: "East Africa",
    urgency: "critical",
    species: [
      { name: "Ring-tailed Lemur", population: "~2,000", status: "Endangered" },
      { name: "Fossa", population: "<2,500", status: "Vulnerable" },
      { name: "Aye-aye", population: "Unknown", status: "Endangered" },
    ],
    threats: ["Habitat loss", "Slash-and-burn agriculture", "Hunting"],
    opportunities: "Fund community-led conservation to save species found nowhere else on Earth.",
  },
  borneo: {
    name: "Borneo",
    region: "Southeast Asia",
    urgency: "high",
    species: [
      { name: "Bornean Orangutan", population: "~104,000", status: "Critically Endangered" },
      { name: "Pygmy Elephant", population: "~1,500", status: "Endangered" },
      { name: "Proboscis Monkey", population: "~7,000", status: "Endangered" },
    ],
    threats: ["Palm oil plantations", "Logging", "Forest fires"],
    opportunities: "Support sustainable palm oil initiatives and wildlife corridors.",
  },
  galapagos: {
    name: "Galápagos Islands",
    region: "Pacific Ocean",
    urgency: "moderate",
    species: [
      { name: "Galápagos Giant Tortoise", population: "~15,000", status: "Vulnerable" },
      { name: "Marine Iguana", population: "~250,000", status: "Vulnerable" },
      { name: "Galápagos Penguin", population: "~2,000", status: "Endangered" },
    ],
    threats: ["Invasive species", "Climate change", "Tourism pressure"],
    opportunities: "Fund breeding programs that have brought species back from the brink.",
  },
  congo: {
    name: "Congo Basin",
    region: "Central Africa",
    urgency: "critical",
    species: [
      { name: "Mountain Gorilla", population: "~1,000", status: "Endangered" },
      { name: "Okapi", population: "~10,000", status: "Endangered" },
      { name: "Forest Elephant", population: "~10,000", status: "Critically Endangered" },
    ],
    threats: ["Poaching", "Civil conflict", "Mining"],
    opportunities: "Support ranger programs protecting the world's second-largest rainforest.",
  },
  arctic: {
    name: "Arctic Circle",
    region: "Northern Hemisphere",
    urgency: "high",
    species: [
      { name: "Polar Bear", population: "~26,000", status: "Vulnerable" },
      { name: "Arctic Fox", population: "Stable", status: "Least Concern" },
      { name: "Narwhal", population: "~80,000", status: "Near Threatened" },
    ],
    threats: ["Sea ice loss", "Climate change", "Oil exploration"],
    opportunities: "Fund climate research and habitat monitoring in rapidly changing ecosystems.",
  },
  "coral-triangle": {
    name: "Coral Triangle",
    region: "Indo-Pacific",
    urgency: "critical",
    species: [
      { name: "Hawksbill Sea Turtle", population: "~8,000", status: "Critically Endangered" },
      { name: "Reef Manta Ray", population: "Unknown", status: "Vulnerable" },
      { name: "Napoleon Wrasse", population: "Declining", status: "Endangered" },
    ],
    threats: ["Overfishing", "Coral bleaching", "Plastic pollution"],
    opportunities: "Support marine protected areas in the world's most biodiverse ocean region.",
  },
  himalayas: {
    name: "Himalayas",
    region: "South Asia",
    urgency: "high",
    species: [
      { name: "Snow Leopard", population: "~4,000", status: "Vulnerable" },
      { name: "Red Panda", population: "~10,000", status: "Endangered" },
      { name: "Himalayan Monal", population: "Unknown", status: "Least Concern" },
    ],
    threats: ["Habitat fragmentation", "Poaching", "Climate change"],
    opportunities: "Fund community conservation programs in high-altitude ecosystems.",
  },
}

interface GlobeRef {
  rotateToHotspot: (hotspotId: string) => void
}

interface GlobeProps {
  onHotspotClick: (id: string) => void
  selectedHotspot: string | null
  onHotspotHover: (id: string | null) => void
  hoveredHotspot: string | null
  globeSpecies: iNaturalistTaxon[]
  onGlobeLoad?: () => void
}

export const Globe = forwardRef<GlobeRef, GlobeProps>(function Globe(
  { onHotspotClick, selectedHotspot, onHotspotHover, hoveredHotspot, globeSpecies, onGlobeLoad },
  ref,
) {
  const globeRef = useRef<THREE.Mesh>(null)
  const targetRotation = useRef<number | null>(null)
  const isRotating = useRef(false)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])
  
  const [dynamicHotspots, setDynamicHotspots] = useState<Array<{
    id: string
    name: string
    position: [number, number, number]
    urgency: "critical" | "high" | "moderate"
    species: string
    taxon: iNaturalistTaxon
    observationCount: number
  }>>([])

  // Create hotspots from search results
  useEffect(() => {
    const createHotspotsFromSpecies = async () => {
      console.log('Globe: createHotspotsFromSpecies called with', globeSpecies.length, 'species')
      if (globeSpecies.length === 0) {
        console.log('Globe: No species provided, clearing hotspots')
        setDynamicHotspots([])
        return
      }

      const hotspotsWithCoords = []
      
      // Process species in batches for better performance
      const speciesBatch = globeSpecies.slice(0, 20) // Can handle more species now with bulk API
      const taxonIds = speciesBatch.map(taxon => taxon.id)
      
      try {
        // Make ONE bulk API call for all species observations
        console.log('Fetching observations for', taxonIds.length, 'species in one call...')
        const observationsByTaxon = await inaturalistAPI.getBulkSpeciesObservations(taxonIds, 3) // 3 observations per species
        console.log('Globe: Received observations for', Object.keys(observationsByTaxon).length, 'species')
        
        // Create hotspots from the bulk data
        const createdHotspots = speciesBatch.map((taxon) => {
          console.log('Globe: Processing species', taxon.name, 'with ID', taxon.id)
          const observations = observationsByTaxon[taxon.id] || []
          
          // Find observations with valid coordinates
          const validObservations = observations.filter(obs => 
            obs.location && obs.location.length === 2 && 
            obs.location[0] !== null && obs.location[1] !== null
          )
          
          let position: [number, number, number]
          let observationCount = 0
          
          if (validObservations.length > 0) {
            // Use the most recent observation's coordinates
            const latestObs = validObservations[0]
            const [lng, lat] = latestObs.location
            
            // Convert lat/lng to 3D coordinates on globe
            const latRad = (lat * Math.PI) / 180
            const lngRad = (lng * Math.PI) / 180
            const x = Math.cos(latRad) * Math.cos(lngRad) * 2.1
            const y = Math.sin(latRad) * 2.1
            const z = Math.cos(latRad) * Math.sin(lngRad) * 2.1
            
            position = [x, y, z]
            observationCount = validObservations.length
          } else {
            // If no coordinates, place randomly but still create the hotspot
            const lat = (Math.random() - 0.5) * Math.PI
            const lng = Math.random() * 2 * Math.PI
            const x = Math.cos(lat) * Math.cos(lng) * 2.1
            const y = Math.sin(lat) * 2.1
            const z = Math.cos(lat) * Math.sin(lng) * 2.1
            
            position = [x, y, z]
            observationCount = 0
          }
          
          const status = inaturalistAPI.getEnhancedIUCNStatus(taxon)
          const priority = inaturalistAPI.getConservationPriority(status)
          const urgency = priority === 'low' ? 'moderate' : priority as "critical" | "high" | "moderate"
          
          return {
            id: `dynamic-${taxon.id}`,
            name: taxon.preferred_common_name || taxon.name,
            position,
            urgency,
            species: taxon.name,
            taxon,
            observationCount
          }
        })
        
        hotspotsWithCoords.push(...createdHotspots)
        console.log(`Successfully created ${createdHotspots.length} hotspots from bulk API call`)
        
      } catch (error) {
        console.error('Bulk API call failed, falling back to individual calls:', error)
        
        // Fallback to individual calls if bulk fails
        const fallbackPromises = speciesBatch.slice(0, 10).map(async (taxon) => {
          try {
            const observations = await inaturalistAPI.getSpeciesObservationsWithGeo(taxon.id, 3)
            const validObservations = observations.filter(obs => 
              obs.location && obs.location.length === 2 && 
              obs.location[0] !== null && obs.location[1] !== null
            )
            
            let position: [number, number, number]
            let observationCount = 0
            
            if (validObservations.length > 0) {
              const latestObs = validObservations[0]
              const [lng, lat] = latestObs.location
              const latRad = (lat * Math.PI) / 180
              const lngRad = (lng * Math.PI) / 180
              const x = Math.cos(latRad) * Math.cos(lngRad) * 2.1
              const y = Math.sin(latRad) * 2.1
              const z = Math.cos(latRad) * Math.sin(lngRad) * 2.1
              position = [x, y, z]
              observationCount = validObservations.length
            } else {
              const lat = (Math.random() - 0.5) * Math.PI
              const lng = Math.random() * 2 * Math.PI
              const x = Math.cos(lat) * Math.cos(lng) * 2.1
              const y = Math.sin(lat) * 2.1
              const z = Math.cos(lat) * Math.sin(lng) * 2.1
              position = [x, y, z]
              observationCount = 0
            }
            
            const status = inaturalistAPI.getEnhancedIUCNStatus(taxon)
            const priority = inaturalistAPI.getConservationPriority(status)
            const urgency = priority === 'low' ? 'moderate' : priority as "critical" | "high" | "moderate"
            
            return {
              id: `dynamic-${taxon.id}`,
              name: taxon.preferred_common_name || taxon.name,
              position,
              urgency,
              species: taxon.name,
              taxon,
              observationCount
            }
          } catch (obsError) {
            console.warn(`Fallback failed for ${taxon.name}:`, obsError)
            // Return random position
            const lat = (Math.random() - 0.5) * Math.PI
            const lng = Math.random() * 2 * Math.PI
            const x = Math.cos(lat) * Math.cos(lng) * 2.1
            const y = Math.sin(lat) * 2.1
            const z = Math.cos(lat) * Math.sin(lng) * 2.1
            
            const status = inaturalistAPI.getEnhancedIUCNStatus(taxon)
            const priority = inaturalistAPI.getConservationPriority(status)
            const urgency = priority === 'low' ? 'moderate' : priority as "critical" | "high" | "moderate"
            
            return {
              id: `dynamic-${taxon.id}`,
              name: taxon.preferred_common_name || taxon.name,
              position: [x, y, z] as [number, number, number],
              urgency,
              species: taxon.name,
              taxon,
              observationCount: 0
            }
          }
        })
        
        const fallbackHotspots = await Promise.all(fallbackPromises)
        hotspotsWithCoords.push(...fallbackHotspots)
      }
      
      console.log(`Created ${hotspotsWithCoords.length} hotspots from search results:`, hotspotsWithCoords)
      
      // If no hotspots were created, add some test markers to verify rendering works
      if (hotspotsWithCoords.length === 0) {
        console.log('No hotspots created, adding test markers...')
        const testHotspots = [
          {
            id: 'test-1',
            name: 'Test Marker 1',
            position: [1.5, 0.5, 1.0] as [number, number, number],
            urgency: 'critical' as const,
            species: 'Test Species',
            taxon: globeSpecies[0] || {} as iNaturalistTaxon,
            observationCount: 5
          },
          {
            id: 'test-2',
            name: 'Test Marker 2',
            position: [-1.5, -0.5, 1.0] as [number, number, number],
            urgency: 'high' as const,
            species: 'Test Species 2',
            taxon: globeSpecies[1] || {} as iNaturalistTaxon,
            observationCount: 3
          }
        ]
        setDynamicHotspots(testHotspots)
      } else {
        setDynamicHotspots(hotspotsWithCoords)
      }
    }

    createHotspotsFromSpecies()
  }, [globeSpecies])

  // Notify parent when globe is loaded
  useEffect(() => {
    if (onGlobeLoad) {
      // Add a small delay to ensure the globe is fully rendered
      const timer = setTimeout(() => {
        onGlobeLoad()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [onGlobeLoad])

  useImperativeHandle(ref, () => ({
    rotateToHotspot: (hotspotId: string) => {
        const hotspot = dynamicHotspots.find((h) => h.id === hotspotId)
        if (hotspot && globeRef.current) {
          const [x, , z] = hotspot.position
          const targetY = Math.atan2(x, z)
          targetRotation.current = targetY
          isRotating.current = true
        }
    },
  }))

  useFrame((state, delta) => {
    if (globeRef.current) {
      if (isRotating.current && targetRotation.current !== null) {
        const diff = targetRotation.current - globeRef.current.rotation.y
        const normalizedDiff = Math.atan2(Math.sin(diff), Math.cos(diff))

        if (Math.abs(normalizedDiff) < 0.01) {
          globeRef.current.rotation.y = targetRotation.current
          isRotating.current = false
          targetRotation.current = null
        } else {
          globeRef.current.rotation.y += normalizedDiff * delta * 2
        }
      } else {
        globeRef.current.rotation.y += delta * 0.05
      }
    }
  })

  const earthTexture = useTexture("/realistic-earth-texture-map.jpg")

  return (
    <group>
      <Sphere ref={globeRef} args={[2, 32, 32]}>
        <meshStandardMaterial 
          map={earthTexture} 
          roughness={0.8} 
          metalness={0.2}
          color="#ffffff"
        />
      </Sphere>

      <Sphere args={[2.05, 32, 32]}>
        <meshBasicMaterial color="#4a90e2" transparent opacity={0.1} side={THREE.BackSide} />
      </Sphere>

      {/* Dynamic hotspots from search results */}
      {dynamicHotspots.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          position={hotspot.position}
          urgency={hotspot.urgency}
          isSelected={selectedHotspot === hotspot.id}
          onClick={() => onHotspotClick(hotspot.id)}
          onPointerOver={() => {
            // Clear any existing timeout
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
            }
            // Set a new timeout for hover
            hoverTimeoutRef.current = setTimeout(() => {
              onHotspotHover(hotspot.id)
            }, 150) // 150ms delay
          }}
          onPointerOut={() => {
            // Clear timeout and immediately hide
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
            onHotspotHover(null)
          }}
        />
      ))}

      {hoveredHotspot && (
        <Html 
          position={dynamicHotspots.find((h) => h.id === hoveredHotspot)?.position as [number, number, number]}
          zIndexRange={[99999, 100000]}
          style={{ zIndex: 99999 }}
          center
        >
          <HotspotTooltip hotspotId={hoveredHotspot} />
        </Html>
      )}
    </group>
  )
})
