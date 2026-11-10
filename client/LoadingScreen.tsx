"use client";

import { useId } from "react";
import StorybookMark from "./StorybookMark.tsx";
import "./loading-screen.css";

export type LoadingPhase = "opening" | "restoring" | "world";

const phaseLabels: Record<LoadingPhase, string> = {
  opening: "Loading game…",
  restoring: "Restoring save…",
  world: "Loading world…",
};

/** Lightweight enough to appear in the server response, before the game boots. */
export default function LoadingScreen({ phase = "opening", preview = false }: { phase?: LoadingPhase; preview?: boolean }) {
  const id = useId();
  const titleId = `${id}-title`;
  const skyId = `${id}-sky`;

  return <main className="storybook-loading" aria-labelledby={titleId} aria-busy={preview ? undefined : true}>
    <div className="loading-frame" aria-hidden="true"><i /><i /><i /><i /></div>
    <header className="loading-masthead">
      <span><StorybookMark size={25} /><span>A life simulator</span></span>
    </header>

    <div className="loading-centre">
      <h1 id={titleId}>Everfolk<span>.</span></h1>

      <div className="loading-illustration" aria-hidden="true">
        <svg viewBox="0 0 520 340" fill="none" focusable="false">
          <defs><clipPath id={skyId}><path d="M153 245V127a107 107 0 0 1 214 0v118Z" /></clipPath></defs>
          <path d="M138 248V128a122 122 0 0 1 244 0v120" stroke="#b58a49" strokeWidth="1.3" />
          <path d="M145 248V128a115 115 0 0 1 230 0v120" stroke="#d8c6a2" />
          <g clipPath={`url(#${skyId})`}>
            <path d="M153 10H367V251H153Z" fill="#ecdfc2" />
            <circle cx="294" cy="91" r="30" fill="#d9b873" />
            <path d="M153 165 178 154H193V139H218V157H239V147H258V166H276V143H294V167H316V156H339V169H367V214H153Z" fill="#c4bd9e" />
            <path d="M153 189H367V251H153Z" fill="#89a7a2" />
            <path d="M166 206H204M284 218H339M179 233H229M320 199H353" stroke="#c6d4be" strokeWidth="2" strokeLinecap="round" />
            <path d="M191 187V131H195V109H207V131H212V187Z" fill="#42686a" />
            <path d="M193 128H210M195 108H207M194 147H209" stroke="#ecdfc2" strokeWidth="2" />
            <path d="M199 104V95H203V104M187 188H216" stroke="#42686a" strokeWidth="4" />
            <path d="M242 197H298L287 209H252Z" fill="#24464b" />
            <path d="M268 150V198M270 153 292 190H270Z" fill="#fcf4df" />
            <path d="M268 150V198" stroke="#24464b" strokeWidth="2" />
            <path d="M266 157 245 190H266Z" fill="#d9b873" />
          </g>
          <path d="M153 245V127a107 107 0 0 1 214 0v118" stroke="#24464b" strokeWidth="3" />
          <path d="M150 245H370" stroke="#b58a49" strokeWidth="4" />
          <path className="loading-orbit" d="M81 172C64 126 107 73 157 54M363 54C413 75 455 128 439 172" stroke="#c9ae79" strokeDasharray="2 9" strokeLinecap="round" />
          <path className="loading-spark loading-spark-one" d="m105 95 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#b58a49" />
          <path className="loading-spark loading-spark-two" d="m415 128 3.4 8.6 8.6 3.4-8.6 3.4-3.4 8.6-3.4-8.6-8.6-3.4 8.6-3.4Z" fill="#b58a49" />
          <path d="M102 194V204M97 199H107M418 75V83M414 79H422" stroke="#b58a49" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M80 261C143 239 203 250 260 278 317 250 377 239 440 261L434 312C372 294 316 303 260 329 204 303 148 294 86 312Z" fill="#24464b" />
          <path d="M91 252C151 235 211 247 260 274V316C208 291 151 280 91 298Z" fill="#fcf4df" stroke="#24464b" strokeWidth="2" strokeLinejoin="round" />
          <path d="M429 252C369 235 309 247 260 274V316C312 291 369 280 429 298Z" fill="#f5e9cd" stroke="#24464b" strokeWidth="2" strokeLinejoin="round" />
          <path d="M106 266C150 257 192 264 230 281M106 279C150 270 192 277 230 294M414 266C370 257 328 264 290 281M414 279C370 270 328 277 290 294" stroke="#cdb992" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M270 270V312L280 305 288 316V263Z" fill="#98584b" />
          <path d="M260 275V321" stroke="#b58a49" strokeWidth="2" />
          <path className="loading-guiding-star" d="m260 3 5.8 15.2L281 24l-15.2 5.8L260 45l-5.8-15.2L239 24l15.2-5.8Z" fill="#b58a49" stroke="#fbf3df" strokeWidth="3" />
          <path d="M170 337H236M284 337H350" stroke="#c7b18a" strokeLinecap="round" />
          <path d="m260 332 5 5-5 5-5-5Z" fill="#b58a49" />
        </svg>
      </div>

      <div className="loading-status" role="status" aria-live="polite" aria-atomic="true">
        <p>{phaseLabels[phase]}</p>
        <div className="loading-progress" aria-hidden="true"><span /></div>
      </div>
      {preview && <a className="loading-preview-enter" href="/">Enter Everfolk <span aria-hidden="true">→</span></a>}
    </div>

    <footer className="loading-footer"><span>Progress saves in this browser.</span></footer>
  </main>;
}
