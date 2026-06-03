"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"
import { Suspense, useState, useRef } from "react"
import { Globe } from "@/app/components/globe"
import { StatsBar } from "@/app/components/stats-bar"
import { SpeciesSearch } from "@/app/components/species-search"
import { HotspotModal } from "@/app/components/hotspot-modal"
import { SpecinateLoader } from "@/app/components/specinate-loader"
import type { OrbitControls as OrbitControlsType } from "three-stdlib"
import type { iNaturalistTaxon } from "@/app/lib/inaturalist"

interface GlobeRef {
  rotateToHotspot: (hotspotId: string) => void
}

export default function Page() {
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<iNaturalistTaxon | null>(null)
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [globeSpecies, setGlobeSpecies] = useState<iNaturalistTaxon[]>([])
  const [isGlobeLoaded, setIsGlobeLoaded] = useState(false)
  const controlsRef = useRef<OrbitControlsType>(null)
  const globeRef = useRef<GlobeRef>(null)

  const handleSpeciesSelect = (species: iNaturalistTaxon) => {
    setSelectedSpecies(species)
    // Add the selected species to globe species if not already present
    setGlobeSpecies(prev => {
      if (!prev.find(s => s.id === species.id)) {
        return [...prev, species]
      }
      return prev
    })

    const hotspotId = `dynamic-${species.id}`
    setSelectedHotspot(hotspotId)

    // Show the popup for this species
    setHoveredHotspot(hotspotId)

    // Rotate globe to the species marker
    if (globeRef.current) {
      globeRef.current.rotateToHotspot(hotspotId)
    }
  }

  const handleHotspotClick = (hotspotId: string) => {
    setSelectedHotspot(hotspotId)
    setIsModalOpen(true)
  }

  return (
    <main className="relative w-full mobile-full-height overflow-y-auto bg-slate-100 flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>

      {/* Loading Overlay */}
             {!isGlobeLoaded && (
               <div className="absolute inset-0 bg-slate-100 flex items-center justify-center z-50">
                 <div className="text-center space-y-4">
                   <SpecinateLoader size="lg" text="The globe is on its way! 🌍" />
                 </div>
               </div>
             )}

      {/* Header Section - Fixed at Top */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-200/50 p-4 lg:p-6 relative z-30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Title and Legend */}
            <div className="flex-1">
              <h1 className="text-2xl lg:text-4xl xl:text-5xl font-bold text-slate-800 text-balance leading-tight mb-4">
                SpeciNate Species Explorer
              </h1>

              {/* Narrative Text */}
              <div className="max-w-3xl">
                <p className="text-slate-600 text-sm lg:text-base leading-relaxed">
                  Discover the world&apos;s most fascinating species through an interactive 3D globe.
                  Explore real-time data from iNaturalist to learn about wildlife conservation,
                  track species observations, and understand the critical importance of biodiversity
                  protection across our planet.
                </p>
              </div>
        </div>

            {/* Search Section */}
            <div className="w-full lg:w-auto lg:max-w-lg">
              <SpeciesSearch onSelectHotspot={handleSpeciesSelect} onGlobeSpecies={setGlobeSpecies} />
            </div>
        </div>
      </div>
      </header>

      {/* Species Globe Section */}
      <section className="globe-container flex-1 relative min-h-0 min-h-[50vh]">
        <Canvas
          camera={{ position: [0, 0, 30], fov: 12 }}
          style={{ touchAction: 'auto' }}
          dpr={[1, 2]}
          performance={{ min: 0.5 }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Globe
              ref={globeRef}
              onHotspotClick={handleHotspotClick}
              selectedHotspot={selectedHotspot}
              onHotspotHover={setHoveredHotspot}
              hoveredHotspot={hoveredHotspot}
                globeSpecies={globeSpecies}
              onGlobeLoad={() => setIsGlobeLoaded(true)}
            />
            <OrbitControls
              ref={controlsRef}
              enablePan={false}
              enableZoom={true}
              minDistance={20}
              maxDistance={60}
              rotateSpeed={0.5}
              touches={{
                ONE: 0, // Single finger rotates
                TWO: 1  // Two fingers zoom
              }}
              mouseButtons={{
                LEFT: 0, // Left mouse rotates
                MIDDLE: 1, // Middle mouse zooms
                RIGHT: undefined // Right mouse disabled
              }}
              enableDamping={true}
              dampingFactor={0.05}
              autoRotate={false}
            />
            <Environment preset="sunset" />
          </Suspense>
        </Canvas>

        {/* Help Icon */}
        <div className="absolute bottom-4 right-4 lg:bottom-6 lg:right-6 z-10">
          <button className="group relative w-10 h-10 lg:w-12 lg:h-12 bg-white/80 backdrop-blur-md border border-white/40 rounded-full shadow-lg hover:bg-white/90 transition-all duration-200 flex items-center justify-center">
            <svg className="w-5 h-5 lg:w-6 lg:h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>

              {/* Tooltip */}
            <div className="absolute bottom-full right-0 mb-2 lg:mb-3 w-48 lg:w-56 bg-white/95 backdrop-blur-md border border-white/40 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              <div className="p-3 lg:p-4 space-y-2 lg:space-y-3">
                <div className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-400 rounded-full"></div>
                    <span>Drag to rotate</span>
            </div>
                <div className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-400 rounded-full"></div>
              <span>Scroll to zoom</span>
            </div>
                <div className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-400 rounded-full"></div>
                    <span>Click hotspots to explore</span>
                  </div>
                </div>
            </div>
            </button>
          </div>
      </section>


      {/* Hotspot Modal */}
      <HotspotModal
        hotspotId={selectedHotspot}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  )
    }
