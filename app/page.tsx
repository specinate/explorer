"use client"

import { Canvas } from "@react-three/fiber"
import { TrackballControls } from "@react-three/drei"
import { Suspense, useState, useRef, useEffect } from "react"
import { Globe, type RotateResult } from "@/app/components/globe"
import { SpeciesSearch } from "@/app/components/species-search"
import { HotspotModal } from "@/app/components/hotspot-modal"
import { GlobeSkeleton } from "@/app/components/globe-skeleton"
import type { TrackballControls as TrackballControlsType } from "three-stdlib"
import { Quaternion } from "three"
import { inaturalistAPI, type iNaturalistTaxon } from "@/app/lib/inaturalist"
import { SightingsRegister } from "@/app/components/sightings-register"
import { SpecimenTag } from "@/app/components/specimen-tag"
import Image from "next/image"

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

  // On large screens the specimen tag sits beside the globe, so a marker tap just fills it;
  // on phones the tag is below the fold, so open the full profile instead
  const handleHotspotClick = (hotspotId: string) => {
    setSelectedHotspot(hotspotId)
    const taxonId = Number(hotspotId.replace("dynamic-", ""))
    const taxon = globeSpecies.find((s) => s.id === taxonId)
    if (taxon) setSelectedSpecies(taxon)
    if (!window.matchMedia("(min-width: 1024px)").matches) setIsModalOpen(true)
  }

  // Open with a species on the tag: the first critically endangered one on the globe
  useEffect(() => {
    if (selectedSpecies || globeSpecies.length === 0) return
    const first =
      globeSpecies.find((s) => inaturalistAPI.getIUCNStatus(s) === "Critically Endangered") ?? globeSpecies[0]
    setSelectedSpecies(first)
    setSelectedHotspot(`dynamic-${first.id}`)
  }, [globeSpecies, selectedSpecies])

  const ctrlBtn = "w-10 h-10 lg:w-11 lg:h-11 flex items-center justify-center text-frost text-xl hover:bg-frost/10 active:bg-frost/15 transition-colors"

  return (
    <main className="w-full min-h-dvh lg:h-dvh bg-night text-frost flex flex-col gap-3 px-[max(16px,env(safe-area-inset-left))] py-3 lg:py-4">
      <div className="mx-auto w-full max-w-[1480px] flex-1 min-h-0 flex flex-col gap-3">
        {/* Header: brand and search */}
        <header className="relative z-30 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/android-chrome-192x192.png" alt="" width={40} height={40} className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg shrink-0" priority />
            <div className="min-w-0">
              <h1 className="font-display text-xl lg:text-2xl font-extrabold tracking-tight leading-tight">
                SpeciNate <span className="font-medium text-mist">Explorer</span>
              </h1>
              <p className="text-xs lg:text-sm text-mist leading-snug">
                Every point is a real iNaturalist sighting. The{" "}
                <span className="font-semibold text-[#ff5a3c]">red</span> ones are running out of time.
              </p>
            </div>
          </div>
          <div className="w-full lg:w-auto lg:max-w-lg">
            <SpeciesSearch onSelectHotspot={handleSpeciesSelect} onGlobeSpecies={setGlobeSpecies} />
          </div>
        </header>

        {/* Stage: register | globe | specimen tag on large screens; globe first on phones */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 lg:grid lg:grid-cols-[270px_minmax(0,1fr)_320px] xl:grid-cols-[290px_minmax(0,1fr)_340px]">
          <div className="order-2 lg:order-none min-h-0 flex flex-col">
            <SightingsRegister
              species={globeSpecies}
              selectedId={selectedSpecies?.id ?? null}
              onSelect={handleSpeciesSelect}
            />
          </div>

          {/* Globe */}
          <section className="globe-container order-1 lg:order-none relative overflow-hidden rounded-2xl border border-rule bg-[radial-gradient(circle_at_50%_45%,#10303c_0%,transparent_62%)] h-[min(100vw,62vh)] min-h-[320px] max-h-[560px] lg:h-auto lg:max-h-none lg:min-h-0">
            {webGLSupported === false ? (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-md text-center space-y-3 rounded-xl border border-rule bg-deep p-6">
                  <h2 className="font-display text-lg font-bold">3D globe unavailable</h2>
                  <p className="text-sm text-mist leading-relaxed">
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
                <ambientLight intensity={0.9} />
                <directionalLight position={[-10, 8, 6]} intensity={1.6} color="#cfe8ee" />
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
                className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full border border-rule bg-deep/90 backdrop-blur-md text-sm text-frost shadow-lg max-w-[calc(100%-2rem)]"
              >
                <span className="w-4 h-4 shrink-0 rounded-full border-2 border-rule border-t-iucn-lc animate-spin" aria-hidden />
                <span className="truncate">Locating {locatingName}&hellip;</span>
              </div>
            )}

            {/* Red List legend */}
            <ul className="absolute top-3 left-3 z-10 hidden sm:flex flex-col gap-1 pointer-events-none text-[11px] text-mist" aria-label="Marker colours">
              {[
                ["CR", "Critically endangered", "bg-iucn-cr"],
                ["EN", "Endangered", "bg-iucn-en"],
                ["VU", "Vulnerable", "bg-iucn-vu"],
                ["NT", "Near threatened", "bg-iucn-nt"],
                ["LC", "Least concern", "bg-iucn-lc"],
              ].map(([code, label, bg]) => (
                <li key={code} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${bg}`} aria-hidden />
                  <span className="font-mono text-frost/80">{code}</span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>

            {/* Zoom, reset and help */}
            {webGLSupported && (
              <div className="absolute bottom-3 right-3 z-10 flex flex-col rounded-xl overflow-hidden border border-rule bg-deep/85 backdrop-blur-md divide-y divide-rule">
                <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.7)} className={ctrlBtn}>+</button>
                <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 0.7)} className={ctrlBtn}>&minus;</button>
                <button type="button" aria-label="Reset view" title="Reset view" onClick={resetView} className={ctrlBtn}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M4.6 15a8 8 0 1 0 1.9-8.3L4 9" />
                  </svg>
                </button>
              </div>
            )}

            <p className="absolute bottom-3 left-3 z-10 hidden sm:block pointer-events-none text-xs text-mist">
              Drag to turn · scroll or pinch to zoom · tap a point
            </p>
          </section>

          {/* Specimen tag */}
          <aside className="order-3 lg:order-none min-h-0 lg:overflow-y-auto flex flex-col gap-3 lg:pb-1" aria-live="polite">
            <SpecimenTag species={selectedSpecies} onOpenProfile={() => setIsModalOpen(true)} />
            <footer className="mt-auto pt-2 text-[11px] leading-snug text-mist">
              © {new Date().getFullYear()} SpeciNate Conservation LLC. Need help?{" "}
              <a href="mailto:corianoharris@specinate.com" className="font-medium text-frost underline-offset-2 hover:underline">
                corianoharris@specinate.com
              </a>
            </footer>
          </aside>
        </div>
      </div>

      {/* Hotspot Modal */}
      <HotspotModal
        hotspotId={selectedSpecies ? `dynamic-${selectedSpecies.id}` : selectedHotspot}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </main>
  )
}
