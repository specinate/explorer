"use client"

import { Canvas } from "@react-three/fiber"
import { TrackballControls, Environment } from "@react-three/drei"
import { Suspense, useState, useRef, useEffect } from "react"
import { Globe, type RotateResult } from "@/app/components/globe"
import { StatsBar } from "@/app/components/stats-bar"
import { SpeciesSearch } from "@/app/components/species-search"
import { HotspotModal } from "@/app/components/hotspot-modal"
import { GlobeSkeleton } from "@/app/components/globe-skeleton"
import type { TrackballControls as TrackballControlsType } from "three-stdlib"
import { Quaternion } from "three"
import type { iNaturalistTaxon } from "@/app/lib/inaturalist"

function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas")
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

interface GlobeRef {
  rotateToHotspot: (hotspotId: string) => Promise<RotateResult>
}

const SKELETON_MIN_MS = 1500

export default function Page() {
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null)
  const [selectedSpecies, setSelectedSpecies] = useState<iNaturalistTaxon | null>(null)
  const [hoveredHotspot, setHoveredHotspot] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [globeSpecies, setGlobeSpecies] = useState<iNaturalistTaxon[]>([])
  const [isGlobeLoaded, setIsGlobeLoaded] = useState(false)
  // Keep the skeleton up for a moment even when the globe loads instantly, so it reads
  // as a deliberate intro rather than a flash
  const [skeletonMinElapsed, setSkeletonMinElapsed] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSkeletonMinElapsed(true), SKELETON_MIN_MS)
    return () => clearTimeout(timer)
  }, [])
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null)
  const controlsRef = useRef<TrackballControlsType>(null)
  const globeRef = useRef<GlobeRef>(null)
  // Name shown while waiting for a selected species' marker to load
  const [locatingName, setLocatingName] = useState<string | null>(null)
  const selectRequestRef = useRef(0)

  useEffect(() => {
    const supported = isWebGLAvailable()
    setWebGLSupported(supported)
    if (!supported) setIsGlobeLoaded(true)
  }, [])

  const handleSpeciesSelect = async (species: iNaturalistTaxon) => {
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

    // Rotate globe to the species marker and show its popup; species with no known
    // wild location have no marker, so open their details instead
    // (its marker may still be loading, so this can wait on the location lookup)
    const request = ++selectRequestRef.current
    const pending = globeRef.current?.rotateToHotspot(hotspotId)
    // Only flash the indicator if the lookup is actually slow
    const showTimer = setTimeout(() => {
      if (selectRequestRef.current === request) {
        setLocatingName(species.preferred_common_name || species.name)
      }
    }, 150)
    const result = pending ? await pending : 'no-marker'
    clearTimeout(showTimer)
    if (selectRequestRef.current === request) setLocatingName(null)
    if (result === 'rotated') {
      setHoveredHotspot(hotspotId)
    } else if (result === 'no-marker') {
      setIsModalOpen(true)
    }
  }

  // Smoothly move the camera toward/away from the globe, respecting the controls' limits
  const zoomBy = (factor: number) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    const start = camera.position.length()
    const end = Math.min(controls.maxDistance, Math.max(controls.minDistance, start * factor))
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 250)
      const eased = 1 - Math.pow(1 - t, 3)
      camera.position.setLength(start + (end - start) * eased)
      controls.update()
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  // Swing back to the starting view: north up, facing the front, default distance
  const resetView = () => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object
    const fromQuat = camera.quaternion.clone()
    const toQuat = new Quaternion() // camera at +Z looking at the origin, Y up
    const fromDist = camera.position.length()
    const toDist = 30
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 600)
      const eased = 1 - Math.pow(1 - t, 3)
      const q = fromQuat.clone().slerp(toQuat, eased)
      camera.position.set(0, 0, fromDist + (toDist - fromDist) * eased).applyQuaternion(q)
      camera.up.set(0, 1, 0).applyQuaternion(q)
      camera.quaternion.copy(q)
      controls.update()
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  const handleHotspotClick = (hotspotId: string) => {
    setSelectedHotspot(hotspotId)
    setIsModalOpen(true)
  }

  return (
    <main className="relative w-full mobile-full-height overflow-y-auto bg-slate-100 flex flex-col">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>


      {/* Header Section - Fixed at Top */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 lg:p-6 relative z-30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            {/* Title and Legend */}
            <div className="flex-1">
              <h1 className="text-xl lg:text-4xl xl:text-5xl font-bold text-slate-800 text-balance leading-tight mb-1 lg:mb-3">
                SpeciNate Species Explorer
              </h1>
              <p className="max-w-2xl text-sm lg:text-base leading-snug text-slate-600">
                Every dot is a real iNaturalist sighting. The{" "}
                <span className="inline-flex items-center gap-1 font-medium text-red-600">
                  <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden />
                  red
                </span>{" "}
                ones are running out of time.
              </p>
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
        {webGLSupported === false ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md text-center space-y-3 bg-white/90 border border-gray-200 rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-slate-800">3D globe unavailable</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your browser couldn&apos;t start WebGL, which the globe needs. Try enabling hardware
                acceleration in your browser settings, updating your graphics drivers, or using a
                different browser. You can still search for species above.
              </p>
            </div>
          </div>
        ) : webGLSupported && (
        <Canvas
          camera={{ position: [0, 0, 30], fov: 12 }}
          style={{ touchAction: 'none' }}
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
            {/* Trackball rather than orbit controls so the globe tumbles freely over the poles */}
            <TrackballControls
              ref={controlsRef}
              noPan
              minDistance={7}
              maxDistance={60}
              rotateSpeed={3}
              zoomSpeed={1.2}
              dynamicDampingFactor={0.1}
              onChange={(e) => {
                // Slow rotation as you zoom in so markers don't fly past your finger
                const c = e?.target as TrackballControlsType | undefined
                if (!c) return
                const d = c.object.position.length()
                c.rotateSpeed = Math.min(3, 3 * ((d - 2) / 28))
              }}
            />
            <Environment preset="sunset" />
          </Suspense>
        </Canvas>
        )}

        {/* Spinning wireframe in the globe's place until it's ready, then fades out */}
        <GlobeSkeleton visible={!isGlobeLoaded || (webGLSupported !== false && !skeletonMinElapsed)} />

        {/* Shown while a selected species' marker is still loading */}
        {locatingName && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md border border-white/40 rounded-full shadow-lg text-sm text-slate-700 max-w-[calc(100%-2rem)]"
          >
            <span className="w-4 h-4 shrink-0 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" aria-hidden />
            <span className="truncate">Locating {locatingName}&hellip;</span>
          </div>
        )}

        {/* Zoom buttons, stacked above the help button */}
        {webGLSupported && (
          <div className="absolute bottom-16 right-4 lg:bottom-20 lg:right-6 z-10 flex flex-col rounded-full overflow-hidden border border-white/40 shadow-lg divide-y divide-slate-200/70">
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.7)} className="w-10 h-10 lg:w-12 lg:h-12 bg-white/80 backdrop-blur-md hover:bg-white/90 active:bg-white transition-colors flex items-center justify-center text-slate-700 text-xl font-medium">+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 0.7)} className="w-10 h-10 lg:w-12 lg:h-12 bg-white/80 backdrop-blur-md hover:bg-white/90 active:bg-white transition-colors flex items-center justify-center text-slate-700 text-xl font-medium">&minus;</button>
            <button type="button" aria-label="Reset view" title="Reset view" onClick={resetView} className="w-10 h-10 lg:w-12 lg:h-12 bg-white/80 backdrop-blur-md hover:bg-white/90 active:bg-white transition-colors flex items-center justify-center text-slate-700 text-xl font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M4.6 15a8 8 0 1 0 1.9-8.3L4 9" />
              </svg>
            </button>
          </div>
        )}

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
              <span>Scroll or pinch to zoom</span>
            </div>
                <div className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-slate-600">
                  <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-400 rounded-full"></div>
                    <span>Click hotspots to explore</span>
                  </div>
                </div>
            </div>
            </button>
          </div>

        {/* Floating footer; narrower than the section so it clears the help button */}
        <footer className="absolute left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] lg:bottom-6 z-10 w-max max-w-[calc(100%-7rem)] lg:max-w-[calc(100%-10rem)] px-4 py-2 bg-white/80 backdrop-blur-md border border-white/40 rounded-2xl lg:rounded-full shadow-lg text-center text-[11px] lg:text-xs text-slate-600 leading-snug">
          <span>© {new Date().getFullYear()} SpeciNate Conservation LLC. All rights reserved.</span>{" "}
          <span className="whitespace-nowrap">
            Need help?{" "}
            <a href="mailto:corianoharris@specinate.com" className="font-medium text-blue-600 hover:text-blue-700 underline-offset-2 hover:underline">
              corianoharris@specinate.com
            </a>
          </span>
        </footer>
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
