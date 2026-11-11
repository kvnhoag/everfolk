import WeaveLab from "../../../../client/demo/WeaveLab.tsx";

export default async function WeaveFeatureTestPage({
  params,
}: {
  params: Promise<{ feature: string }> | { feature: string };
}) {
  const resolved = await params;
  return <WeaveLab initialPreset={resolved?.feature} />;
}
