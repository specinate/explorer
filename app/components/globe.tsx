"use client"

import { useRef, forwardRef, useImperativeHandle, useState, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Sphere, Html } from "@react-three/drei"
import { useTexture } from "@react-three/drei"
import * as THREE from "three"
import { Hotspot } from "./hotspot"
import { HotspotTooltip } from "./hotspot-tooltip"
import { inaturalistAPI, getSightingLatLng, getStatusMarkerColor, type iNaturalistTaxon } from "@/app/lib/inaturalist"

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
  // Resolves once the marker's location is known: 'rotated' when the globe turns to it,
  // 'no-marker' when the species has no mappable sighting, 'superseded' if another
  // selection came in first
  rotateToHotspot: (hotspotId: string) => Promise<RotateResult>
}

interface GlobeProps {
  onHotspotClick: (id: string) => void
  selectedHotspot: string | null
  onHotspotHover: (id: string | null) => void
  hoveredHotspot: string | null
  globeSpecies: iNaturalistTaxon[]
  onGlobeLoad?: () => void
}

export type RotateResult = 'rotated' | 'no-marker' | 'superseded'

const MARKER_RADIUS = 2.1

// Matches how SphereGeometry wraps an equirectangular texture: longitude 0 faces +X
// and east runs toward -Z, so z needs the negative sine
function latLngToPosition(lat: number, lng: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  return [
    Math.cos(latRad) * Math.cos(lngRad) * MARKER_RADIUS,
    Math.sin(latRad) * MARKER_RADIUS,
    -Math.cos(latRad) * Math.sin(lngRad) * MARKER_RADIUS,
  ]
}

// Upper bound on markers; the search list adds species 20 at a time via "Show more"
const MAX_MARKERS = 100
const BULK_BATCH_SIZE = 20
// Parallel per-species lookups for species the bulk request missed
const LOOKUP_CONCURRENCY = 4

export const Globe = forwardRef<GlobeRef, GlobeProps>(function Globe(
  { onHotspotClick, selectedHotspot, onHotspotHover, hoveredHotspot, globeSpecies, onGlobeLoad },
  ref,
) {
  const globeRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  // Camera swing toward a selected marker: the full turn, the camera's start pose, and progress
  const cameraSwing = useRef<{
    turn: THREE.Quaternion
    fromPosition: THREE.Vector3
    fromUp: THREE.Vector3
    progress: number
  } | null>(null)
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
    color: string
    species: string
    taxon: iNaturalistTaxon
  }>>([])

  // Where each species' marker sits (null = no wild sighting with coordinates, so no marker).
  // Kept across searches and "Show more" so nothing is fetched twice
  const placementsRef = useRef(new Map<number, [number, number, number] | null>())

  // A selection waiting on its marker's location to load
  const pendingRotationRef = useRef<{ id: string; resolve: (r: RotateResult) => void } | null>(null)

  const rotateToPosition = (position: [number, number, number]) => {
    // Swing the camera round the globe until the marker faces it; works from any viewing
    // angle, since the controls let the camera tumble freely
    const globe = globeRef.current
    if (!globe) return
    const markerDir = new THREE.Vector3(...position).applyMatrix4(globe.matrixWorld).normalize()
    const cameraDir = camera.position.clone().normalize()
    cameraSwing.current = {
      turn: new THREE.Quaternion().setFromUnitVectors(cameraDir, markerDir),
      fromPosition: camera.position.clone(),
      fromUp: camera.up.clone(),
      progress: 0,
    }
  }

  // Settle a waiting selection once placements are known (or loading failed)
  const settlePendingRotation = (loadedIds: Set<number>, failed = false) => {
    const pending = pendingRotationRef.current
    if (!pending) return
    const taxonId = Number(pending.id.replace('dynamic-', ''))
    const position = placementsRef.current.get(taxonId)
    if (position) {
      rotateToPosition(position)
      pending.resolve('rotated')
    } else if (failed || !loadedIds.has(taxonId) || position === null) {
      pending.resolve('no-marker')
    } else {
      return
    }
    pendingRotationRef.current = null
  }

  // Create hotspots from search results
  useEffect(() => {
    let cancelled = false

    const createHotspotsFromSpecies = async () => {
      try {
        await placeSpecies()
      } catch (error) {
        console.error('Failed to place species markers:', error)
        if (!cancelled) settlePendingRotation(new Set(), true)
      }
    }

    const placeSpecies = async () => {
      const species = globeSpecies.slice(0, MAX_MARKERS)
      const placements = placementsRef.current
      const missingIds = species.map((taxon) => taxon.id).filter((id) => !placements.has(id))

      // One bulk request covers most species, but it returns the newest sightings across
      // all of them (max ~200), so common species can crowd out rare ones
      const unplaced: number[] = []
      for (let i = 0; i < missingIds.length; i += BULK_BATCH_SIZE) {
        const batch = missingIds.slice(i, i + BULK_BATCH_SIZE)
        const observationsByTaxon = await inaturalistAPI.getBulkSpeciesObservations(batch, 3)
        for (const id of batch) {
          const latLng = (observationsByTaxon[id] || []).map(getSightingLatLng).find(Boolean)
          if (latLng) {
            placements.set(id, latLngToPosition(latLng.lat, latLng.lng))
          } else {
            unplaced.push(id)
          }
        }
      }

      // Look the crowded-out species up individually, a few at a time
      const queue = [...unplaced]
      await Promise.all(Array.from({ length: LOOKUP_CONCURRENCY }, async () => {
        for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
          const sighting = await inaturalistAPI.getLatestSighting(id)
          const latLng = sighting && getSightingLatLng(sighting)
          placements.set(id, latLng ? latLngToPosition(latLng.lat, latLng.lng) : null)
        }
      }))

      if (cancelled) return

      setDynamicHotspots(species.flatMap((taxon) => {
        const position = placements.get(taxon.id)
        if (!position) return []
        return [{
          id: `dynamic-${taxon.id}`,
          name: taxon.preferred_common_name || taxon.name,
          position,
          color: getStatusMarkerColor(inaturalistAPI.getIUCNStatus(taxon)),
          species: taxon.name,
          taxon,
        }]
      }))
      settlePendingRotation(new Set(species.map((taxon) => taxon.id)))
    }

    createHotspotsFromSpecies()
    return () => {
      cancelled = true
    }
  }, [globeSpecies])

  // Notify parent once the globe has drawn its first frame. This component only mounts
  // after its Earth texture loads (useTexture suspends), so that frame shows the real globe
  const hasNotifiedLoad = useRef(false)
  useFrame(() => {
    if (!hasNotifiedLoad.current) {
      hasNotifiedLoad.current = true
      onGlobeLoad?.()
    }
  })

  useImperativeHandle(ref, () => ({
    rotateToHotspot: (hotspotId: string) => {
      pendingRotationRef.current?.resolve('superseded')
      pendingRotationRef.current = null
      const hotspot = dynamicHotspots.find((h) => h.id === hotspotId)
      if (hotspot) {
        rotateToPosition(hotspot.position)
        return Promise.resolve<RotateResult>('rotated')
      }
      const taxonId = Number(hotspotId.replace('dynamic-', ''))
      if (placementsRef.current.get(taxonId) === null) {
        return Promise.resolve<RotateResult>('no-marker')
      }
      // Marker still loading; settled when the placement effect finishes
      return new Promise<RotateResult>((resolve) => {
        pendingRotationRef.current = { id: hotspotId, resolve }
      })
    },
  }))

  useFrame((state, delta) => {
    const swing = cameraSwing.current
    if (swing) {
      // About one second, easing out
      swing.progress = Math.min(1, swing.progress + delta)
      const eased = 1 - Math.pow(1 - swing.progress, 3)
      const step = new THREE.Quaternion().slerp(swing.turn, eased)
      camera.position.copy(swing.fromPosition).applyQuaternion(step)
      camera.up.copy(swing.fromUp).applyQuaternion(step)
      camera.lookAt(0, 0, 0)
      if (swing.progress >= 1) cameraSwing.current = null
    } else if (globeRef.current) {
      // Slow idle spin, paused while the camera swings so the marker doesn't drift away
      globeRef.current.rotation.y += delta * 0.05
    }
  })

  const hoveredHotspotData = hoveredHotspot ? dynamicHotspots.find((h) => h.id === hoveredHotspot) : undefined

  const earthTexture = useTexture("/realistic-earth-texture-map.jpg")

  return (
    <group>
      {/* Globe and markers rotate together so markers stay pinned to their locations */}
      <group ref={globeRef}>
        <Sphere args={[2, 32, 32]}>
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
            color={hotspot.color}
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

        {hoveredHotspotData && (
          <Html 
            position={hoveredHotspotData.position}
            zIndexRange={[99999, 100000]}
            style={{ zIndex: 99999 }}
          >
            <HotspotTooltip hotspotId={hoveredHotspotData.id} />
          </Html>
        )}
      </group>
    </group>
  )
})
