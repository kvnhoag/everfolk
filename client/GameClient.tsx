"use client";
import dynamic from "next/dynamic";
import LoadingScreen from "./screens/LoadingScreen.tsx";

// Restoring a life needs browser storage. Keep the game and its retained-world
// engines out of the SSR worker, which otherwise loads them just to show this loader.
const GameClient = dynamic(() => import("./screens/GameScreen.tsx"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default GameClient;
