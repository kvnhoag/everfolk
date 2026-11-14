"use client";

import { useSyncExternalStore } from "react";
import type { ModuleLoadingProgress } from "../state/module-loading.ts";
import LoadingScreen from "../screens/LoadingScreen.tsx";

export default function ModuleLoadingScreen({ loading }: { loading: ModuleLoadingProgress }) {
  const progress = useSyncExternalStore(loading.subscribe, loading.getSnapshot, loading.getServerSnapshot);
  return <LoadingScreen progress={progress} />;
}
