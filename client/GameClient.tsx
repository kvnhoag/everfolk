"use client";
import dynamic from "next/dynamic";
import ModuleLoadingScreen from "./components/ModuleLoadingScreen.tsx";
import { createModuleLoadingProgress } from "./state/module-loading.ts";

const loading = createModuleLoadingProgress();

// Restoring a life needs browser storage. Keep the game and its retained-world
// engines out of the SSR worker, which otherwise loads them just to show this loader.
const GameClient = dynamic(() => loading.track(
  () => import("./screens/GameScreen.tsx"),
  [
    () => import("./lib/world-session.ts"),
    () => import("./chain/life-world.ts"),
    () => import("./screens/App.tsx"),
    () => import("./chain/ChainLayer.tsx"),
  ],
), {
  ssr: false,
  loading: () => <ModuleLoadingScreen loading={loading} />,
});

export default GameClient;
