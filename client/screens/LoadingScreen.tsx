import { useId } from "react";
import type { LoadingPhase } from "../types/loading.ts";
import { BRAND_TAGLINE } from "../components/EverfolkBrand.tsx";

const phaseLabels: Record<LoadingPhase, string> = {
  opening: "Loading game…",
  restoring: "Restoring save…",
  world: "Loading world…",
};

/** Renders in the server response before the game boots. */
export default function LoadingScreen({ phase = "opening", preview = false }: { phase?: LoadingPhase; preview?: boolean }) {
  const titleId = useId();
  // Keep the first frame sized and legible even before the streamed CSS arrives.
  return <main className="storybook-loading" aria-labelledby={titleId} aria-busy={preview ? undefined : true}
    style={{ boxSizing: "border-box", minHeight: "100svh", display: "grid", placeItems: "center", padding: "clamp(20px, 5vw, 48px)", background: "#102e37", color: "#e7e0c9" }}>
    <div style={{ width: "min(100%, 680px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <h1 id={titleId} style={{ width: "min(78%, 410px)", margin: "0 0 10px" }}>
        <img src="/assets/branding/everfolk-wordmark-cream.svg" alt="Everfolk" width={1280} height={291} style={{ display: "block", width: "100%", height: "auto" }} />
      </h1>
      <p className="everfolk-brand-tagline" style={{ margin: "0 0 18px", color: "#f1cf88", fontSize: 13, fontWeight: 500, letterSpacing: "4px", lineHeight: 1.2, textTransform: "uppercase" }}>{BRAND_TAGLINE}</p>
      <div role="status" aria-live="polite" aria-atomic="true"
        style={{ marginBottom: "clamp(18px, 3vh, 30px)", color: "#ead6b7", fontSize: 14, lineHeight: 1.5 }}>{phaseLabels[phase]}</div>
      <svg viewBox="0 0 240 106" width={240} height={106} style={{ display: "block", width: "100%", height: "auto" }}
        shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        <path fill="#31525d" d="M0 0h240v66H0z" />
        <path fill="#bb9273" d="M0 35h240v21H0z" />
        <path fill="#e2b58a" d="M0 47h240v9H0z" />
        <path fill="#f5d49c" d="M177 33h16v3h5v5h3v15h-32V42h3v-5h5z" />
        <path fill="#728b8d" d="M0 56V47h13v-3h12v5h16v-3h8v6h22v4h72v-3h12v-5h9v5h28v-4h15v-3h10v5h23v5z" />
        <path fill="#317176" d="M0 56h240v27H0z" />
        <path fill="#519193" d="M0 57h240v2H0zM9 65h22v1H9zM102 64h47v1h-47zM56 73h36v1H56zM8 78h57v1H8z" />
        <path fill="#c2ad86" d="M169 58h35v1h-35zM160 63h49v1h-49zM174 68h26v1h-26zM153 74h67v1h-67z" />
        <path fill="#f3dfb0" d="M40 51h-2v18H23v-2h15V52H27v2h2v4h3v4h3v4h5z" />
        <path fill="#514546" d="M24 69h24v2h-4v2H28v-2h-4z" />
        <path fill="#293e46" d="M0 92h240v14H0z" />
        <path fill="#aa8a72" d="M0 82h240v4H0z" />
        <path fill="#d9bc93" d="M0 81h240v2H0z" />
        <path fill="#655854" d="M0 86h240v6H0z" />
        <path stroke="#3a3d43" d="M16 86v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6m18-6v6" />
        <path fill="#332e34" d="M12 77h4v5h-4zm214 0h4v5h-4z" />
        <path fill="#e0be8d" d="M12 77h4v1h-4zm214 0h4v1h-4z" />
        <g transform="translate(109 54)">
          <g className="loading-soldier">
            <path fill="#816b60" d="M0 27h21v2H0z" />
            <g className="loading-soldier-leg loading-soldier-leg-back">
              <path fill="#352f39" d="M7 19h5v8h2v1H7z" />
              <path fill="#ab785d" d="M8 20h3v5H8z" />
            </g>
            <g className="loading-soldier-leg loading-soldier-leg-front">
              <path fill="#352f39" d="M12 19h5v8h2v1h-7z" />
              <path fill="#e0a578" d="M13 20h3v5h-3z" />
            </g>
            <path fill="#533934" d="M7 3h9v2h2v5h-3v2H7V8H5V5h2z" />
            <path fill="#e6bd7e" d="M8 3h8v2h2v2H6V5h2z" />
            <path fill="#a65443" d="M9 1h7v3h-2V3H9z" />
            <path fill="#e7ad7d" d="M11 7h5v3h-2v2h-3z" />
            <path fill="#e8d3a5" d="M8 11h7v2h3v7H6v-6h2z" />
            <path fill="#a65443" d="M7 12h4v9H5v-6h2z" />
            <path fill="#4c3e42" d="M17 8h1v16h-1z" />
            <path fill="#f3d69f" d="M17 5h1v4h-1z" />
            <path fill="#d2a86d" d="M7 13h6v2h2v4h-2v2H7v-2H5v-4h2z" />
            <path fill="#9b5743" d="M8 15h4v4H8z" />
            <path fill="#f6d494" d="M9 16h2v2H9z" />
          </g>
        </g>
      </svg>
      {preview && <a className="loading-preview-enter" href="/">Enter Everfolk <span aria-hidden="true">→</span></a>}
    </div>
  </main>;
}
