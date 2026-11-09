import type { ReactNode } from "react";
import "../client/styles.css";

export const metadata = {
  title: "Historical Lives — Rhakotis to Alexandria",
  description: "One life in another age. A historical life simulation with a complete year-by-year story.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
