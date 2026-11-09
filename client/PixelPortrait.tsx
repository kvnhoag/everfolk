import { portraitVariant } from "./life-background.ts";

export interface PixelPortraitProps {
  age?: number;
  seed?: string;
  name?: string;
  className?: string;
}

/** Presentation follows the same stable identity seed as the life record. */
export default function PixelPortrait({ age = 18, seed = "", name = "Your character", className = "portrait" }: PixelPortraitProps) {
  const stage = age < 3 ? "infant" : age < 13 ? "child" : age < 18 ? "youth" : age < 40 ? "adult" : age < 60 ? "middle" : "elder";
  return <img className={`pixel-portrait ${className}`} src={`/assets/pixel/portraits/${stage}-${portraitVariant(seed)}.svg`} width={32} height={40} alt={`Pixel portrait of ${name}, ${stage === "elder" ? "in later life" : stage === "middle" ? "in middle age" : stage === "infant" ? "an infant in a cradle" : stage === "child" ? "a child" : stage === "youth" ? "a young person" : "an adult"}`} draggable={false} />;
}
