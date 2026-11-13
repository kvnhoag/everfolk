import EverfolkWordmark from "./EverfolkWordmark.tsx";

export const BRAND_TAGLINE = "Weaving fates";

/** The single Everfolk brand lockup: the wordmark over the "Weaving fates" tagline. Ink on paper, cream on teal. */
export default function EverfolkBrand({ tone = "ink", className = "" }: {
  tone?: "ink" | "cream";
  className?: string;
}) {
  return <span className={`everfolk-brand${className ? ` ${className}` : ""}`} data-tone={tone}>
    <EverfolkWordmark tone={tone} />
    <span className="everfolk-brand-tagline">{BRAND_TAGLINE}</span>
  </span>;
}
