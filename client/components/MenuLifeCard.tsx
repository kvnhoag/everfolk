import { formatYear } from "../../src/calendar.ts";

/** Life details and the continue action share the same menu card. */
export default function MenuLifeCard({ label, name, age, year, disabled, onContinue }: {
  label: string; name: string; age?: number; year?: number; disabled?: boolean; onContinue?: () => void;
}) {
  const Card = onContinue ? "button" : "div";
  return <Card className="ef-home-save" {...(onContinue ? { type: "button" as const, onClick: onContinue, disabled } : {})}>
    <span className="ef-home-save-mark" aria-hidden="true" />
    <span className="ef-home-save-details"><span>{label}</span><strong>{name}</strong></span>
    {(age !== undefined || year !== undefined) && <span className="ef-home-save-age">{age !== undefined && `Age ${age}`}{year !== undefined && <small>{formatYear(year)}</small>}</span>}
  </Card>;
}
