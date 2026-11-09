import { useId } from "react";

const icons: Record<string, string[]> = {
  heart: [".###.###.", "#########", "#########", ".#######.", "..#####..", "...###...", "....#...."],
  book: ["####.####", "#..#.#..#", "#.##.##.#", "#..#.#..#", "#.##.##.#", "####.####", "...###..."],
  coin: ["..#####..", ".##...##.", "##..#..##", "##.###.##", "##..#..##", ".##...##.", "..#####.."],
  people: ["..##..##.", "..##..##.", ".........", ".####.###", "######.##", "######.##", "##..##.##"],
  hourglass: ["#########", ".##...##.", "..##.##..", "...###...", "..##.##..", ".#######.", "#########"],
  arrow: [".....#...", "......#..", ".......#.", "#########", ".......#.", "......#..", ".....#..."],
  check: ["........#", ".......##", "......##.", "#....##..", "##..##...", ".####....", "..##....."],
  pause: [".###.###.", ".###.###.", ".###.###.", ".###.###.", ".###.###.", ".###.###.", ".###.###."],
  play: ["..##.....", "..####...", "..######.", "..#######", "..######.", "..####...", "..##....."],
  close: ["##.....##", ".##...##.", "..##.##..", "...###...", "..##.##..", ".##...##.", "##.....##"],
  download: ["....#....", "....#....", "..#.#.#..", "...###...", "....#....", "#.......#", "#########"],
  restart: ["...#####.", "..##...##", ".##.....#", "####....#", "........#", ".##...##.", "..#####.."],
  pin: ["..#####..", ".##...##.", ".##.#.##.", ".##...##.", "..#####..", "...###...", "....#...."],
  feather: [".....####", "....#####", "...#####.", "..#####..", "..####...", ".##......", "##......."],
  ship: ["....#....", "...##.#..", "..###.##.", ".####.###", "....#....", "#########", ".#######."],
  home: ["....#....", "...###...", "..#####..", ".#######.", "..##.##..", "..##.##..", "..#####.."],
  sun: ["....#....", ".#..#..#.", "...###...", "#########", "...###...", ".#..#..#.", "....#...."],
  sculpture: ["...####..", "...####..", "....##...", "..######.", "..######.", "...####..", "..######."],
  military: [".#######.", ".#..#..#.", ".#.###.#.", ".#..#..#.", "..#.#.#..", "...###...", "....#...."],
  commerce: ["....#....", ".#######.", ".#..#..#.", ".#..#..#.", "###.#.###", "....#....", "..#####.."],
  "astronomy-calendar": [".#.....#.", "....#....", "..#####..", "..#.#.#..", "..#####..", "..#.#.#..", "..#####.."],
  "music-performance": [".##...##.", ".#######.", ".#.#.#.#.", ".#.#.#.#.", ".#.#.#.#.", "..#####..", "...###..."],
};
const aliases: Record<string, string> = { health: "heart", knowledge: "book", wealth: "coin", bonds: "people", philosophy: "book", seafaring: "ship", astronomy: "astronomy-calendar", music: "music-performance", craft: "sculpture", literacy: "book", reckoning: "commerce", warfare: "military" };

export interface PixelIconProps { name: string; size?: number; className?: string; label?: string }

/** A small monochrome bitmap drawn as integer SVG rectangles. */
export default function PixelIcon({ name, size = 20, className = "", label }: PixelIconProps) {
  const titleId = useId();
  const cells = icons[aliases[name] ?? name] ?? icons.sun;
  return <svg className={`pixel-icon ${className}`} width={size} height={size} viewBox="0 0 11 11" fill="currentColor" shapeRendering="crispEdges" role={label ? "img" : undefined} aria-hidden={label ? undefined : true} aria-labelledby={label ? titleId : undefined} focusable="false">
    {label && <title id={titleId}>{label}</title>}
    {cells.flatMap((row, y) => [...row].flatMap((cell, x) => cell === "#" ? <rect x={x + 1} y={y + 2} width={1} height={1} key={`${x}-${y}`} /> : []))}
  </svg>;
}
