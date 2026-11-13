import type { WorldPack } from "../../src/types.ts";
import type { RelationshipRow } from "../models/relationship-table.ts";
import { relationshipBond } from "../models/relationship-table.ts";
import { displayProse } from "../models/display-prose.ts";
import PixelPortrait from "./PixelPortrait.tsx";
import "../styles/relationship-table.css";

export default function RelationshipTable({ rows, world, caption, emptyText }: {
  rows: readonly RelationshipRow[]; world: WorldPack; caption: string; emptyText: string;
}) {
  if (!rows.length) return <p className="character-empty">{emptyText}</p>;
  return <div className="relationship-table-block">
    <p className="relationship-table-hint">Scroll across to see background, work and bonds.</p>
    <div className="relationship-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table className="relationship-table">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Person</th><th scope="col">Relationship</th><th scope="col">Background</th><th scope="col">Occupation</th><th scope="col">Bond</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id} className={row.deceased ? "is-deceased" : undefined}>
          <th scope="row"><div className="relationship-person"><PixelPortrait portrait={row.portrait} name={row.name} className="relationship-person-portrait" /><div><strong>{row.name}</strong><span>{row.age}</span></div></div></th>
          <td><ul className="relationship-table-roles">{row.roles.length ? row.roles.map(role => <li key={role}>{role}</li>) : <li>Acquaintance</li>}</ul></td>
          <td>{row.backgroundDetail ? <details className="relationship-table-background"><summary>{row.background}</summary><p>{displayProse(row.backgroundDetail)}</p></details> : row.background}</td>
          <td>{row.occupation}</td>
          <td>{row.tie ? <><strong>{relationshipBond(row.tie.closeness, world)} · {row.tie.closeness}/100</strong><span>Last contact: age {row.tie.lastContactAge}</span></> : <span>Not recorded</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
