"use client"

import { useEffect, useRef } from "react"
import { inaturalistAPI, getStatusMarkerColor, IUCN_CODE_BY_STATUS, type iNaturalistTaxon } from "@/app/lib/inaturalist"

interface SightingsRegisterProps {
  species: iNaturalistTaxon[]
  selectedId: number | null
  onSelect: (species: iNaturalistTaxon) => void
}

// The species currently on the globe. A scrolling list on large screens; on phones it
// collapses to one swipeable row of chips so it never pushes the globe out of view.
export function SightingsRegister({ species, selectedId, onSelect }: SightingsRegisterProps) {
  const listRef = useRef<HTMLOListElement>(null)

  // Bring the selected species into view, whichever way the list scrolls
  useEffect(() => {
    if (selectedId == null) return
    listRef.current
      ?.querySelector(`[data-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [selectedId])

  return (
    <section
      aria-label="Species on the globe"
      className="flex flex-col min-h-0 overflow-hidden rounded-2xl border border-rule bg-deep"
    >
      <header className="flex items-baseline justify-between px-4 pt-3 pb-2 lg:pt-4 lg:pb-3 border-b border-rule">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mist">On the globe</span>
        <span className="font-mono text-xs text-mist tabular-nums">{species.length} species</span>
      </header>

      {species.length === 0 ? (
        <p className="px-4 py-4 text-sm text-mist">Species you search for appear here and on the globe.</p>
      ) : (
        <ol
          ref={listRef}
          className="no-scrollbar flex gap-1.5 overflow-x-auto overflow-y-hidden p-2.5 snap-x lg:flex-col lg:gap-0 lg:overflow-x-hidden lg:overflow-y-auto lg:p-1.5 lg:flex-1"
        >
          {species.map((taxon) => {
            const status = inaturalistAPI.getIUCNStatus(taxon)
            const code = IUCN_CODE_BY_STATUS[status]
            const color = getStatusMarkerColor(status)
            const isSelected = taxon.id === selectedId
            return (
              <li key={taxon.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  data-id={taxon.id}
                  aria-current={isSelected}
                  onClick={() => onSelect(taxon)}
                  className={`group grid items-center gap-x-2.5 text-left transition-colors
                    grid-cols-[9px_auto_auto] max-w-[220px] rounded-full border border-rule px-3 py-1.5
                    lg:w-full lg:max-w-none lg:grid-cols-[9px_1fr_auto] lg:rounded-lg lg:border-0 lg:px-2.5 lg:py-2
                    ${isSelected ? "bg-frost/10 border-frost/30" : "hover:bg-frost/5"}`}
                >
                  <span className="w-[9px] h-[9px] rounded-full lg:row-span-2" style={{ background: color }} aria-hidden />
                  <span className="truncate text-sm font-semibold text-frost">
                    {taxon.preferred_common_name || taxon.name}
                  </span>
                  <span className="font-mono text-[11px] lg:row-span-2" style={{ color }}>
                    {code && code !== "NE" ? code : "—"}
                  </span>
                  {taxon.preferred_common_name && (
                    <span className="hidden lg:block col-start-2 truncate text-xs italic text-mist">{taxon.name}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
