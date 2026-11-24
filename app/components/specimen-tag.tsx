"use client"

import Image from "next/image"
import { ArrowRight, ExternalLink } from "lucide-react"
import { inaturalistAPI, IUCN_CODE_BY_STATUS, type iNaturalistTaxon } from "@/app/lib/inaturalist"

interface SpecimenTagProps {
  species: iNaturalistTaxon | null
  onOpenProfile: () => void
}

// Red List categories from least to most severe, in the IUCN's own colours
const SCALE: Array<{ code: string; color: string; darkText: boolean }> = [
  { code: "LC", color: "#60c659", darkText: true },
  { code: "NT", color: "#cce226", darkText: true },
  { code: "VU", color: "#f9e814", darkText: true },
  { code: "EN", color: "#fc7f3f", darkText: true },
  { code: "CR", color: "#d81e05", darkText: false },
  { code: "EW", color: "#542344", darkText: false },
  { code: "EX", color: "#000000", darkText: false },
]

const GROUP_LABELS: Record<string, string> = {
  Aves: "Bird",
  Mammalia: "Mammal",
  Reptilia: "Reptile",
  Amphibia: "Amphibian",
  Actinopterygii: "Fish",
  Mollusca: "Mollusk",
  Arachnida: "Arachnid",
  Insecta: "Insect",
  Animalia: "Animal",
}

// Wikipedia summaries come back with inline HTML (<b>, <i>, etc.)
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").trim()

// The selected species, styled as a museum specimen tag with a tear-off stub
export function SpecimenTag({ species, onOpenProfile }: SpecimenTagProps) {
  if (!species) {
    return (
      <div className="rounded-2xl border border-dashed border-rule p-6 text-sm text-mist">
        Pick a species from the list or tap a point on the globe to see its Red List status.
      </div>
    )
  }

  const status = inaturalistAPI.getIUCNStatus(species)
  const code = IUCN_CODE_BY_STATUS[status]
  const level = SCALE.findIndex((s) => s.code === code)
  const current = level >= 0 ? SCALE[level] : null
  const statusLabel = status === "Not Evaluated" ? "Not yet assessed" : status
  const commonName = species.preferred_common_name || species.name
  const group = species.iconic_taxon_name ? GROUP_LABELS[species.iconic_taxon_name] || species.iconic_taxon_name : null
  const photo = species.default_photo?.medium_url
  const summary = species.wikipedia_summary ? stripHtml(species.wikipedia_summary) : null
  const assessor = species.conservation_status?.authority || species.conservation_status?.place?.name

  const chip = current
    ? { background: current.color, color: current.darkText ? "#1a1a1a" : "#fff" }
    : { background: "var(--tag-ink)", color: "var(--lichen)" }

  return (
    <article
      key={species.id}
      className="animate-tag-in relative overflow-hidden rounded-[8px_8px_8px_24px] bg-lichen text-tag-ink shadow-[0_18px_40px_-18px_#000]"
    >
      {/* Photo with a status ribbon (large screens) */}
      {photo && (
        <div className="relative hidden lg:block h-40 bg-tag-ink/10">
          {/* Above the fold on large screens and usually the page's largest paint, so don't lazy-load */}
          <Image src={photo} alt={commonName} fill sizes="340px" loading="eager" className="object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/45 to-transparent" />
          <span
            className="absolute bottom-3 left-4 inline-flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-xs font-bold shadow-md"
            style={chip}
          >
            <span className="rounded-full bg-black/15 px-1.5 py-px font-mono text-[10.5px] font-medium">{code ?? "—"}</span>
            {statusLabel}
          </span>
        </div>
      )}

      {/* Punch hole for the tag string */}
      <span
        className="absolute top-3 right-3.5 lg:top-3.5 lg:right-4 z-10 w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full bg-night shadow-[inset_0_0_0_2px_rgba(26,42,32,0.25)]"
        aria-hidden
      />

      <div className="px-4 pt-3 pb-4 lg:px-5 lg:pt-4">
        {/* Identity */}
        <div className="flex items-start gap-3">
          {photo && (
            <div className="relative lg:hidden w-16 h-16 shrink-0 overflow-hidden rounded-lg bg-tag-ink/10">
              <Image src={photo} alt={commonName} fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 pr-4 lg:pr-0">
            <p className="font-mono text-[11px] tracking-wide opacity-60">
              iNat #{species.id}
              {group && <> · {group}</>}
            </p>
            <h2 className="mt-1 font-display text-[1.35rem] lg:text-[1.7rem] font-extrabold leading-[1.05] tracking-tight text-balance">
              {commonName}
            </h2>
            {species.preferred_common_name && (
              <p className="mt-1 truncate text-sm lg:text-[15px] italic opacity-75">{species.name}</p>
            )}
            {/* Phones have no photo ribbon, so show the status here */}
            <span
              className="lg:hidden mt-2 inline-flex items-center gap-1.5 rounded-full py-0.5 pl-1 pr-2.5 text-[11px] font-bold"
              style={chip}
            >
              <span className="rounded-full bg-black/15 px-1.5 font-mono text-[10px] font-medium">{code ?? "—"}</span>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Red List scale: one continuous bar, the species' category raised with a pointer */}
        <figure className="mt-5 lg:mt-4" aria-label={`IUCN Red List: ${statusLabel}`}>
          <div className="relative flex h-2.5 lg:h-3 mt-3">
            {SCALE.map((s, i) => {
              const on = i === level
              return (
                <span
                  key={s.code}
                  className={`relative flex-1 first:rounded-l-full last:rounded-r-full transition-all ${
                    on ? "z-10 -my-1 rounded-sm ring-2 ring-lichen shadow-md" : ""
                  }`}
                  style={{ background: s.color, opacity: on ? 1 : level >= 0 ? 0.28 : 0.45 }}
                >
                  {on && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
                      style={{ borderTopColor: "var(--tag-ink)" }}
                      aria-hidden
                    />
                  )}
                </span>
              )
            })}
          </div>
          <div className="mt-1.5 flex">
            {SCALE.map((s, i) => (
              <span
                key={s.code}
                className={`flex-1 text-center font-mono text-[10px] ${i === level ? "font-bold opacity-100" : "opacity-45"}`}
              >
                {s.code}
              </span>
            ))}
          </div>
          <figcaption className="mt-0.5 flex justify-between text-[10px] uppercase tracking-wider opacity-50">
            <span>Least concern</span>
            <span>Extinct</span>
          </figcaption>
        </figure>

        {/* About (large screens) */}
        {summary && (
          <p className="hidden lg:block mt-4 text-[13px] leading-relaxed opacity-80 line-clamp-3">{summary}</p>
        )}

        {/* Facts */}
        <dl className="mt-4 grid grid-cols-2 divide-x divide-tag-ink/15 border-y border-tag-ink/15">
          <div className="py-2 pr-3">
            <dt className="text-[10px] font-semibold uppercase tracking-widest opacity-55">Sightings</dt>
            <dd className="mt-0.5 font-mono text-base font-medium tabular-nums">
              {species.observations_count?.toLocaleString() ?? "Unknown"}
            </dd>
          </div>
          <div className="py-2 pl-3 min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-widest opacity-55">Assessed by</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold" title={assessor}>
              {assessor ?? "No assessment"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Tear-off stub: perforation with notches cut into both edges */}
      <div className="relative border-t-2 border-dashed border-tag-ink/20 px-4 py-3 lg:px-5">
        <span className="absolute -top-[9px] -left-2 w-4 h-4 rounded-full bg-night" aria-hidden />
        <span className="absolute -top-[9px] -right-2 w-4 h-4 rounded-full bg-night" aria-hidden />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProfile}
            className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-tag-ink px-4 text-sm font-semibold text-lichen hover:brightness-125"
          >
            Full profile
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
          <a
            href={`https://www.inaturalist.org/taxa/${species.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold underline-offset-4 hover:underline"
          >
            iNaturalist
            <ExternalLink className="w-3.5 h-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}
