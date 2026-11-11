import type { InfluenceMarker } from "./influence-marker.ts";

/** Gold star for a famous figure, faience diamond for a person of the city: shape, label and colour all differ. */
export default function InfluenceMarkerTag({ marker }: { marker: InfluenceMarker }) {
  return <p className={`influence-marker is-${marker.material}`} data-token={marker.tokenId}>
    <svg className="influence-marker-glyph" viewBox="0 0 12 12" aria-hidden="true">
      {marker.kind === "figure"
        ? <path d="M6 .6 7.4 4.6 11.4 6 7.4 7.4 6 11.4 4.6 7.4.6 6 4.6 4.6Z" />
        : <path d="M6 1 11 6 6 11 1 6Z" />}
    </svg>
    <span className="influence-marker-who">Shaped by <strong>{marker.who}</strong></span>
    <span className="influence-marker-action"><span className="sr-only">: </span>{marker.actionLabel}</span>
  </p>;
}
