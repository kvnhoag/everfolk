import { WeaveLabPage } from "../../../../client/screens/BrowserPages.tsx";

export default async function WeaveFeatureTestPage({
  params,
}: {
  params: Promise<{ feature: string }> | { feature: string };
}) {
  const resolved = await params;
  return <WeaveLabPage initialPreset={resolved?.feature} />;
}
