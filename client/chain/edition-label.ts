/** Display only edition facts returned by the contract; a token id is never an edition number. */
export interface EditionValues { edition_number?: number; edition_limit?: number | null }
export interface EditionPreviewValues { next_edition_number?: number | null; edition_limit?: number | null }

function label(number: number | undefined, limit: number | null | undefined): string | null {
  if (!Number.isSafeInteger(number) || Number(number) < 1 || limit === undefined) return null;
  const serial = String(number).padStart(3, "0");
  if (limit === null) return `${serial} · Unlimited`;
  // Upgraded collections can contain older copies above a newly introduced cap.
  // Display their recorded serial honestly; only new issuance is capped.
  if (!Number.isSafeInteger(limit) || limit < 1) return null;
  return `${serial}/${String(limit).padStart(3, "0")}`;
}

export function editionLabel(value: EditionValues): string | null {
  return label(value.edition_number, value.edition_limit);
}

/** A current onchain preview, never a reserved or guaranteed serial. */
export function nextEditionLabel(value: EditionPreviewValues): string | null {
  if (value.next_edition_number === null && Number.isSafeInteger(value.edition_limit) && Number(value.edition_limit) > 0) return "Edition sold out";
  const next = label(value.next_edition_number ?? undefined, value.edition_limit);
  return next ? `Next edition ${next}` : null;
}
