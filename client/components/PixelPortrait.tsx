import { avatarStage, portraitSource } from "../models/life-background.ts";
import type { AvatarSex } from "../models/life-background.ts";

export interface PixelPortraitProps {
  age?: number;
  seed?: string;
  name?: string;
  className?: string;
  originId?: string;
  sex?: AvatarSex;
  avatarVariant?: number;
}

/** Presentation follows the same stable identity seed as the life record. */
export default function PixelPortrait({ age = 18, seed = "", name = "Your character", className = "portrait", sex, originId, avatarVariant }: PixelPortraitProps) {
  const stage = avatarStage(age);
  return <img className={`pixel-portrait ${className}`} src={portraitSource({ age, seed, sex, originId, avatarVariant })} width={32} height={40} alt={`Pixel portrait of ${name}, ${stage === "elder" ? "in later life" : stage === "middle" ? "in middle age" : stage === "infant" ? "an infant in a cradle" : stage === "child" ? "a child" : stage === "youth" ? "a young person" : "an adult"}`} draggable={false} />;
}
