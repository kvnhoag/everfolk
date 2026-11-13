"use client";
import dynamic from "next/dynamic";
import LoadingScreen from "./LoadingScreen.tsx";

// These screens bundle multi-megabyte world packs, so they render in the browser only.
// Server rendering them loaded every pack into the Worker and exhausted its memory.
export const GamePage = dynamic(() => import("../GameClient.tsx"), { ssr: false, loading: () => <LoadingScreen /> });
export const NpcLabPage = dynamic(() => import("./NpcSessionLab.tsx"), { ssr: false, loading: () => <LoadingScreen /> });
export const SkillTreePage = dynamic(() => import("./SkillTreePreview.tsx"), { ssr: false, loading: () => <LoadingScreen /> });
