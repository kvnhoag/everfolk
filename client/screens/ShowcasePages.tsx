"use client";

import dynamic from "next/dynamic";
import LoadingScreen from "./LoadingScreen.tsx";
import ModuleLoadingScreen from "../components/ModuleLoadingScreen.tsx";
import { createModuleLoadingProgress } from "../state/module-loading.ts";

const householdLoading = createModuleLoadingProgress();

// Keep the household world and the pack's 3D scene in separate browser bundles.
export const RoyaltyShowcasePage = dynamic(() => householdLoading.track(() => import("./RoyaltyTestScreen.tsx"), [
  () => import("../lib/world-session.ts"),
  () => import("./App.tsx"),
]), { ssr: false, loading: () => <ModuleLoadingScreen loading={householdLoading} /> });
export const PackShowcasePage = dynamic(() => import("./PackShowcaseScreen.tsx"), { ssr: false, loading: () => <LoadingScreen /> });
