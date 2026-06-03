"use client"

import { Card } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { X, AlertTriangle, TrendingDown, Users } from "lucide-react"

const HOTSPOT_DATA: Record<
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

interface SpeciesPanelProps {
  hotspotId: string
  onClose: () => void
}

export function SpeciesPanel({ hotspotId, onClose }: SpeciesPanelProps) {
  const data = HOTSPOT_DATA[hotspotId]

  if (!data) return null

  const urgencyColors = {
    critical: "bg-destructive text-destructive-foreground",
    high: "bg-chart-4 text-white",
    moderate: "bg-accent text-accent-foreground",
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] z-20 p-4 md:p-6 pointer-events-none">
      <Card className="h-full overflow-y-auto pointer-events-auto bg-card/95 backdrop-blur-sm border-border shadow-2xl">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge className={urgencyColors[data.urgency]}>{data.urgency.toUpperCase()} PRIORITY</Badge>
              <h2 className="text-2xl font-bold text-card-foreground">{data.name}</h2>
              <p className="text-sm text-muted-foreground">{data.region}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Species List */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Endangered Species
            </h3>
            <div className="space-y-3">
              {data.species.map((species, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-card-foreground">{species.name}</h4>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {species.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    Population: {species.population}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Threats */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Primary Threats
            </h3>
            <ul className="space-y-2">
              {data.threats.map((threat, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                  {threat}
                </li>
              ))}
            </ul>
          </div>

          {/* Opportunities */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-card-foreground">Conservation Opportunities</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{data.opportunities}</p>
          </div>

          {/* CTA */}
          <Button className="w-full" size="lg">
            Support Conservation
          </Button>
        </div>
      </Card>
    </div>
  )
}
