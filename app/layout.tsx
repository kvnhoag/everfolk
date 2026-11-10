import type { ReactNode } from "react";
import "../client/styles.css";

export const metadata = {
  title: "Everfolk",
  description: "A storybook life simulator set on Egypt's ancient Mediterranean coast.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
