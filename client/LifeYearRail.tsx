import type { CSSProperties } from "react";
import { formatYear, yearAtAge } from "../src/calendar.ts";
import type { LifeState } from "../src/types.ts";

/** A passive lifetime scale. The Life record owns history navigation. */
export default function LifeYearRail({ life }: {
  life: LifeState;
}) {
  const birthYear = yearAtAge(life.year, -life.age);
  const lastAge = Math.max(90, Math.ceil(life.age / 10) * 10);
  const stops = Array.from({ length: lastAge / 10 + 1 }, (_, index) => index * 10);
  const currentDecade = Math.floor(life.age / 10) * 10;
  const style = {
    "--life-progress": `${Math.min(100, life.age / lastAge * 100)}%`,
    "--life-stop-count": stops.length,
  } as CSSProperties;

  return <section className="life-year-rail" aria-label="Your lifetime" style={style}>
    <div className="life-year-rail-heading">
      <strong>A life through time</strong>
      <span>Birth {formatYear(birthYear)} · Age {life.age}</span>
    </div>
    <div className="life-year-rail-track">
      <div className="life-year-rail-progress" aria-hidden="true" />
      <span className="life-year-rail-present" role="img" aria-label={`Current year ${formatYear(life.year)}, age ${life.age}`} />
      <ol className="life-year-rail-stops">
        {stops.map(age => {
          const lived = age <= life.age;
          const current = age === currentDecade;
          const year = formatYear(yearAtAge(birthYear, age));
          return <li className={`life-year-stop${lived ? " is-lived" : ""}${current ? " is-current" : ""}`} key={age}>
            <span className="life-year-stop-label"
              aria-label={lived ? `Age ${age}, ${year}` : `Age ${age}, ${year}, not yet lived`}
              aria-current={current ? "step" : undefined} title={year}>
              <span className="life-year-stop-age">{age === 0 ? "Birth" : age}</span>
              <span className="life-year-stop-year">{year}</span>
            </span>
          </li>;
        })}
      </ol>
    </div>
  </section>;
}
