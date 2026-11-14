/** Colour shows direction; assistive text keeps that information available without colour. */
export default function ImpactValue({ min, max = min, inverse = false, suffix = "" }: { min: number; max?: number; inverse?: boolean; suffix?: string }) {
  const amount = (value: number) => Number(Math.abs(value).toPrecision(12)).toString();
  // Every number carries its sign, so a gain never reads like a cost: +1, −20, −2 to +3.
  const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${amount(value)}`;
  const direction = (value: number) => (inverse ? -value : value) > 0 ? "gain" : (inverse ? -value : value) < 0 ? "loss" : "neutral";
  const mixed = min < 0 && max > 0;
  const lower = max <= 0 ? max : min;
  const upper = max <= 0 ? min : max;
  const description = min === 0 && max === 0 ? "no change"
    : min === max ? `${min > 0 ? "increase" : "decrease"} by ${amount(min)}`
    : mixed ? `decrease by ${amount(min)} to increase by ${amount(max)}`
    : `${max <= 0 ? "decrease" : "increase"} by ${amount(lower)} to ${amount(upper)}`;
  const accessibleDescription = `${description}${suffix ? ` ${suffix}` : ""}`;
  return <span className="impact-stat-value" title={accessibleDescription}>
    <span className="sr-only">{accessibleDescription}</span>
    <span aria-hidden="true">
      {mixed ? <><span className={`impact-${direction(min)}`}>{signed(min)}</span><span className="impact-range-separator"> to </span><span className={`impact-${direction(max)}`}>{signed(max)}</span></>
        : <span className={`impact-${direction(min === 0 ? max : min)}`}>{signed(lower)}{min !== max && <> to {signed(upper)}</>}</span>}
      {suffix && <> {suffix}</>}
    </span>
  </span>;
}
