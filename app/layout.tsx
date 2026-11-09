import type { ReactNode } from "react";
import "../client/styles.css";

export const metadata = {
  title: "Everfolk — Live another story",
  description: "Live another story. A historical life simulation where your choices shape a life in another age.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
