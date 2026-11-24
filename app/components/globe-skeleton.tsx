"use client"

// Loading screen drawn as a twin of the real globe: the same dot-matrix coastlines, the
// same camera, and markers dropping in as their locations really come back. Its last
// frame matches the 3D globe underneath, so the cross-fade reads as the globe waking up
// rather than one picture swapping for another.

import { useEffect, useMemo, useRef, useState } from "react"
import { landDots, latLngToXYZ } from "@/app/lib/land"
import type { PlacementProgress } from "./globe"

// Must match the <Canvas> camera in page.tsx and the globe's geometry in globe.tsx
const CAMERA_Z = 30
const TAN_HALF_FOV = Math.tan(((12 / 2) * Math.PI) / 180)
const GLOBE_RADIUS = 2
const LAND_RADIUS = 2.004
const LAND_DOT_SIZE = 0.22
const MARKER_SIZE = 0.08
const IDLE_SPIN = 0.05 // radians per second, as in globe.tsx

const LAND_SWEEP_MS = 700 // coastlines draw in from the north
const MARKER_STAGGER_MS = 90 // markers land one after another, however fast they arrive
const PING_MS = 700
const HOLD_MS = 450 // let the last marker settle before handing over

interface GlobeSkeletonProps {
  visible: boolean
  progress: PlacementProgress | null
  // Called once every marker has been shown, so the page can reveal the real globe
  onMarkersShown?: () => void
}

export function GlobeSkeleton({ visible, progress, onMarkersShown }: GlobeSkeletonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(progress)
  const onShownRef = useRef(onMarkersShown)
  useEffect(() => {
    progressRef.current = progress
    onShownRef.current = onMarkersShown
  })
  const [caption, setCaption] = useState("Drawing coastlines…")
  const [fraction, setFraction] = useState(0)
  // Keep drawing through the fade-out, then stop
  const [running, setRunning] = useState(true)
  useEffect(() => {
    if (visible) {
      setRunning(true)
      return
    }
    const timer = setTimeout(() => setRunning(false), 800)
    return () => clearTimeout(timer)
  }, [visible])

  const land = useMemo(() => landDots(1.4).map(({ lat, lng }) => ({ lat, xyz: latLngToXYZ(lat, lng, LAND_RADIUS) })), [])

  useEffect(() => {
    if (!running) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    // Touch devices draw larger markers (see hotspot.tsx)
    const markerScale = window.matchMedia("(pointer: coarse)").matches ? 1.75 : 1

    let width = 0
    let height = 0
    let dpr = 1
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const start = performance.now()
    // When each marker (by species id) was shown; markers queue behind one another
    const shownAt = new Map<number, number>()
    let nextSlot = start + LAND_SWEEP_MS
    let finishedAt: number | null = null
    let lastCaption = ""
    let lastFraction = -1
    let frame = 0

    const draw = (now: number) => {
      const W = width * dpr
      const H = height * dpr
      const halfH = H / 2
      const cx = W / 2
      const cy = H / 2
      const elapsed = now - start
      const angle = reduceMotion ? 0 : (elapsed / 1000) * IDLE_SPIN
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      // The real globe's perspective camera: everything scales with distance from the lens
      const project = ([x, y, z]: [number, number, number]) => {
        const rx = x * cos + z * sin
        const rz = -x * sin + z * cos
        const depth = CAMERA_Z - rz
        const scale = halfH / (depth * TAN_HALF_FOV)
        return { sx: cx + rx * scale, sy: cy - y * scale, z: rz, scale }
      }

      ctx.clearRect(0, 0, W, H)

      // Ocean and atmosphere
      const r = (GLOBE_RADIUS * halfH) / (Math.sqrt(CAMERA_Z ** 2 - GLOBE_RADIUS ** 2) * TAN_HALF_FOV)
      const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.3, r * 0.1, cx, cy, r)
      ocean.addColorStop(0, "#124150")
      ocean.addColorStop(1, "#0a2a35")
      ctx.fillStyle = ocean
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = "rgba(90, 180, 200, 0.18)"
      ctx.lineWidth = r * 0.04
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.03, 0, Math.PI * 2)
      ctx.stroke()

      // Land: square points like three.js draws them, sweeping in from the north
      const sweepLat = reduceMotion ? -90 : 90 - Math.min(1, elapsed / LAND_SWEEP_MS) * 180
      const horizon = (GLOBE_RADIUS * GLOBE_RADIUS) / CAMERA_Z
      ctx.fillStyle = "#8ff0c4"
      for (const dot of land) {
        if (dot.lat < sweepLat) continue
        const p = project(dot.xyz)
        if (p.z <= horizon) continue
        const size = LAND_DOT_SIZE * p.scale * TAN_HALF_FOV
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, p.z / GLOBE_RADIUS)
        ctx.fillRect(p.sx - size / 2, p.sy - size / 2, size, size)
      }
      ctx.globalAlpha = 1

      // Queue newly resolved species; each takes the next free slot
      const current = progressRef.current
      for (const entry of current?.resolved ?? []) {
        if (shownAt.has(entry.id)) continue
        const slot = reduceMotion ? now : Math.max(now, nextSlot)
        shownAt.set(entry.id, slot)
        if (entry.position) nextSlot = slot + MARKER_STAGGER_MS
      }

      let shown = 0
      for (const entry of current?.resolved ?? []) {
        const at = shownAt.get(entry.id)!
        if (now < at) continue
        shown++
        if (!entry.position) continue
        const p = project(entry.position)
        if (p.z <= horizon) continue
        const age = now - at
        const pop = reduceMotion ? 1 : Math.min(1, age / 180)
        const pulse = entry.critical && !reduceMotion ? 1 + Math.sin(now / 333) * 0.15 : 1
        // Markers are real spheres (world units); land dots above are screen-space points
        const radius = MARKER_SIZE * markerScale * p.scale * pulse * (0.5 + 0.5 * pop)
        ctx.globalAlpha = 0.9 * pop
        ctx.fillStyle = entry.color
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2)
        ctx.fill()
        // A ping as it lands; critically endangered ones keep pinging, like the real globe
        if (!reduceMotion && (age < PING_MS || entry.critical)) {
          const phase = age < PING_MS ? age / PING_MS : ((now / 1000) * 0.7) % 1
          ctx.globalAlpha = 0.6 * (1 - phase)
          ctx.strokeStyle = entry.color
          ctx.lineWidth = Math.max(1, radius * 0.35)
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, radius * (1.3 + phase * 1.8), 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // Caption and progress
      const total = current?.total ?? 0
      let text: string
      if (!current || (total === 0 && !current.done)) text = elapsed < LAND_SWEEP_MS ? "Drawing coastlines…" : "Finding species…"
      else if (shown < total || !current.done) text = `Placing species ${shown} of ${total}`
      else text = `${current.resolved.filter((e) => e.position).length} species placed`
      if (text !== lastCaption) {
        lastCaption = text
        setCaption(text)
      }
      const nextFraction = total ? Math.round((shown / total) * 100) / 100 : 0
      if (nextFraction !== lastFraction) {
        lastFraction = nextFraction
        setFraction(nextFraction)
      }

      if (current?.done && shown >= total && finishedAt === null) finishedAt = now
      if (finishedAt !== null && now - finishedAt >= HOLD_MS) {
        onShownRef.current?.()
        finishedAt = Infinity
      }

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [running, land])

  return (
    <div
      // Opaque so it covers the globe while that loads underneath, then fades to reveal it.
      // It takes pointer events while shown so a drag can't move the camera out from under it.
      className={`absolute inset-0 bg-night transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!visible}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden />
      {/* Top of the stage: the bottom corners hold the hint, the species button and zoom controls */}
      <div className="absolute inset-x-0 top-[5%] flex flex-col items-center gap-2" role="status">
        <p className="text-sm text-mist tabular-nums">{caption}</p>
        <div className="h-0.5 w-28 overflow-hidden rounded-full bg-rule" aria-hidden>
          <div className="h-full bg-lichen transition-[width] duration-150 ease-linear" style={{ width: `${fraction * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
