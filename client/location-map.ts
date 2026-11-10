import type { LifeState, WorldPack } from "../src/types.ts";
import { formatYear } from "../src/calendar.ts";
import { classicalFoundationYear, worldPlace } from "./world-era.ts";

export interface MapPlace {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  kind: "settlement" | "landmark" | "water";
}

export interface LocationMapModel {
  placeName: string;
  yearLabel: string;
  homeNote: string;
  founded: boolean;
  lighthouseBuilt: boolean;
  cityPlaces: MapPlace[];
  egyptPlaces: MapPlace[];
  cityMarker: { x: number; y: number };
  egyptMarker: { x: number; y: number };
  sources: { title: string; url: string }[];
}

export function supportsLocationMap(world: WorldPack): boolean {
  return /^alexandria(?:-|$)/i.test(world.id) || classicalFoundationYear(world) !== undefined;
}

function milestoneYear(world: WorldPack, id: string, fallback: number): number {
  const event = world.events.find(item => item.id === id);
  return event?.trigger.type === "year" ? event.trigger.at : fallback;
}

/** A schematic view of the recorded home setting, never inferred from jobs or
 * permanent journey flags. Opening or exploring it cannot change the life. */
export function buildLocationMap(world: WorldPack, life: LifeState): LocationMapModel {
  const foundationYear = classicalFoundationYear(world) ?? -331;
  const founded = life.year >= foundationYear;
  const lighthouseBuilt = founded && life.year >= milestoneYear(world, "classical-pharos-completed", -280);
  const placeName = classicalFoundationYear(world) !== undefined || founded ? worldPlace(world, life.year) : "Rhakotis coast";
  return {
    placeName,
    yearLabel: formatYear(life.year),
    homeNote: "The pin marks your home area on Egypt’s Mediterranean coast. It does not identify a particular house.",
    founded,
    lighthouseBuilt,
    cityMarker: { x: 390, y: 245 },
    egyptMarker: { x: 330, y: 110 },
    cityPlaces: [
      { id: "home", label: placeName, kind: "settlement", x: 430, y: 270,
        description: founded ? "Your home area is Alexandria, on the strip of land between the Mediterranean Sea and Lake Mareotis. The city grows beside the older settlement of Rhakotis." : `Your home area is the coast near Rhakotis. Alexandria has not yet been founded; its foundation is marked in ${formatYear(foundationYear)}.` },
      { id: "mediterranean", label: "Mediterranean Sea", kind: "water", x: 650, y: 75,
        description: "The Mediterranean lies north of your home coast and connects Egypt with other shores of the ancient world." },
      { id: "pharos", label: lighthouseBuilt ? "Pharos lighthouse" : "Pharos island", kind: "landmark", x: 245, y: 125,
        description: lighthouseBuilt ? "The great lighthouse stands on Pharos by this period, marking Alexandria’s approach from the sea. Its completion date is approximate." : "Pharos lies offshore from the mainland. The great lighthouse is not yet part of this coast." },
      { id: "mareotis", label: "Lake Mareotis", kind: "water", x: 410, y: 425,
        description: "Lake Mareotis, also known as Lake Mariut, lies south of the city’s coastal strip. Its shoreline and connections with the Nile have changed over time." },
      ...(founded ? [{ id: "eastern-harbour", label: "Eastern harbour", kind: "landmark" as const, x: 510, y: 160,
        description: "The bay east of Pharos becomes Alexandria’s Great Harbour. Harbour works and the surrounding city develop over generations." }] : []),
    ],
    egyptPlaces: [
      { id: "home", label: placeName, kind: "settlement", x: 330, y: 110,
        description: "Your home coast lies west of the Nile Delta, on Egypt’s Mediterranean shore. Switch to the Alexandria area to look around the local coast." },
      { id: "delta", label: "Nile Delta", kind: "landmark", x: 465, y: 145,
        description: "The Nile branches across a broad, fertile delta before reaching the Mediterranean. Your home coast lies along its western edge." },
      { id: "memphis", label: "Memphis", kind: "settlement", x: 475, y: 225,
        description: "Memphis is an ancient city near the entrance to the Nile Delta, upstream and southeast of Alexandria." },
      { id: "thebes", label: "Thebes", kind: "settlement", x: 500, y: 390,
        description: "Thebes, near modern Luxor, lies far upstream in Upper Egypt. The Nile flows north from here toward the Delta." },
      { id: "elephantine", label: "Elephantine", kind: "settlement", x: 540, y: 465,
        description: "Elephantine is an island by the First Cataract near modern Aswan, farther south along the Nile." },
    ],
    sources: [
      { title: "NASA · Egypt’s Mediterranean coast", url: "https://science.nasa.gov/earth/earth-observatory/egypts-mediterranean-coast-154431/" },
      { title: "Centre d’Études Alexandrines · Ancient harbours", url: "https://www.cealex.org/promotion-and-dissemination/exhibitions/the-harbours-of-alexandria/harbours-antiquity/" },
      { title: "Strabo · Geography 17.1.6–8", url: "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Strabo/17A1*.html" },
      { title: "UCL · Memphis and the Nile Delta", url: "https://www.ucl.ac.uk/museums-static/digitalegypt/memphis/background.html" },
      { title: "UNESCO · Ancient Thebes", url: "https://whc.unesco.org/en/list/87" },
      { title: "German Archaeological Institute · Elephantine", url: "https://www.dainst.org/en/research/projects/noslug/5234" },
    ],
  };
}
