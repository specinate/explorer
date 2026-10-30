// Placeholder shown where the 3D globe will appear: a wireframe sphere whose meridians
// sweep around so it reads as spinning. Each meridian is the outline circle squashed
// horizontally (scaleX 1 → -1), staggered so they pass across the face one after another.

const MERIDIAN_COUNT = 6
const SPIN_SECONDS = 6
const LATITUDES = [-60, -30, 0, 30, 60]

export function GlobeSkeleton({ visible }: { visible: boolean }) {
  return (
    <div
      // Opaque so it covers the globe while that loads underneath, then fades to reveal it
      className={`absolute inset-0 bg-slate-100 flex flex-col items-center justify-center gap-4 pointer-events-none transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="status"
      aria-hidden={!visible}
    >
      {/* The real globe fills ~63% of the canvas height (radius 2, camera at z=30, fov 12) */}
      <svg viewBox="-52 -52 104 104" className="h-[63%] max-w-[90%] aspect-square" aria-hidden>
        <defs>
          <radialGradient id="globe-skeleton-fill" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </radialGradient>
        </defs>

        <circle r="50" fill="url(#globe-skeleton-fill)" className="globe-skeleton-pulse" />

        <g fill="none" stroke="#94a3b8" strokeWidth="0.6" opacity="0.7">
          {LATITUDES.map((lat) => {
            const rad = (lat * Math.PI) / 180
            return <ellipse key={lat} cy={-Math.sin(rad) * 50} rx={Math.cos(rad) * 50} ry={Math.cos(rad) * 8} />
          })}
          {Array.from({ length: MERIDIAN_COUNT }, (_, i) => (
            <ellipse
              key={i}
              rx="50"
              ry="50"
              className="globe-skeleton-meridian"
              // Keep the line width constant while the ellipse is squashed
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${(-SPIN_SECONDS / MERIDIAN_COUNT) * i}s`, animationDuration: `${SPIN_SECONDS}s` }}
            />
          ))}
        </g>

        <circle r="50" fill="none" stroke="#94a3b8" strokeWidth="0.8" />
      </svg>

      <p className="text-sm text-slate-500">Loading the globe…</p>
    </div>
  )
}
