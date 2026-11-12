/** Original single-ink workshop marks; no external asset request or icon font. */
export default function CapabilityIcon({ id, branch, specialization }: { id: string; branch: string; specialization: string | null }) {
  const family = specialization === "Military practice" ? "shield" : specialization === "Conditioning" || branch === "Physique" && (!id || id==="F1") ? "body"
    : branch === "Farming" || branch === "Physique" ? specialization === "Resilience" ? "store" : id === "F3W" ? "water" : "grain"
    : branch === "Artisan" || branch === "Handmade" ? specialization === "Clothing" ? "cloth" : specialization === "Ceramics" ? "vessel" : specialization === "Sculpture" ? "bust" : "tools"
      : branch === "Philosophy" || branch === "Knowledge" ? specialization === "Research" ? "measure" : specialization === "Civic practice" ? "forum" : "book" : "scales";
  return <svg className="capability-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-mark={family}>
    {family === "body" && <><circle cx="16" cy="6" r="3"/><path d="M10 29l2-10-5-5 3-4 6 3 6-3 3 4-5 5 2 10M12 19h8M16 13v6M4 8l3 6M28 8l-3 6"/></>}
    {family === "shield" && <><path d="M16 3 27 7v9c0 7-7 12-11 14C12 28 5 23 5 16V7L16 3Z"/><path d="M16 8v16M11 13h10M12 23l4-4 4 4"/></>}
    {family === "grain" && <><path d="M16 27V5M16 11c-5 0-7-3-7-6 5 0 7 3 7 6Zm0 7c-5 0-7-3-7-6 5 0 7 3 7 6Zm0 6c-5 0-7-3-7-6 5 0 7 3 7 6Zm0-10c5 0 7-3 7-6-5 0-7 3-7 6Zm0 7c5 0 7-3 7-6-5 0-7 3-7 6Z" /></>}
    {family === "water" && <><path d="M4 23h24M7 27h18M16 4c-2 4-6 8-6 12a6 6 0 0 0 12 0c0-4-4-8-6-12Z" /><path d="M13 16c0 2 1 3 3 3" /></>}
    {family === "store" && <><path d="m4 12 12-8 12 8M7 11v16h18V11M12 27V16h8v11M4 27h24" /><path d="M11 11h10M12 20h8M16 16v11" /></>}
    {family === "tools" && <><path d="m7 26 14-14M19 5l8 8-4 4-8-8 4-4ZM6 7l3-3 17 20-3 3L6 7Z" /><path d="m6 25 2 2M20 7l5 5" /></>}
    {family === "cloth" && <><path d="m11 5 5 3 5-3 7 7-5 4v11H9V16l-5-4 7-7Z" /><path d="M12 9c2 3 6 3 8 0M12 19h8M12 23h8M16 14v13" /></>}
    {family === "vessel" && <><path d="M11 5h10M12 5v5c-1 2-6 4-6 10 0 5 4 7 10 7s10-2 10-7c0-6-5-8-6-10V5M9 16h14M7 20h18M11 24h10" /><path d="m12 17 4 3 4-3" /></>}
    {family === "bust" && <><path d="M12 5h9v7l-3 4v3l8 4v4H6v-4l8-4v-3l-4-5 2-6ZM8 27v2h16v-2M13 9h2M19 9h1M15 13h3" /><path d="m14 19 2 4 2-4" /></>}
    {family === "book" && <><path d="M16 8c-4-3-8-3-12-2v19c4-1 8-1 12 2 4-3 8-3 12-2V6c-4-1-8-1-12 2Zm0 0v19M8 11l4 1M8 16l4 1M20 12l4-1M20 17l4-1" /></>}
    {family === "measure" && <><circle cx="16" cy="8" r="3" /><path d="m14 11-7 17M18 11l7 17M11 20h10M16 15v7M5 26h5M22 26h5M24 4v6M21 7h6" /></>}
    {family === "forum" && <><path d="m4 11 12-7 12 7H4ZM7 14v10M12 14v10M20 14v10M25 14v10M5 25h22M3 28h26M16 16v4M14 18h4" /></>}
    {family === "scales" && <><path d="M16 4v24M6 9h20M5 28h22M7 9l-5 11h10L7 9Zm18 0-5 11h10L25 9Z" /><path d="M2 20a5 5 0 0 0 10 0M20 20a5 5 0 0 0 10 0" /></>}
  </svg>;
}
