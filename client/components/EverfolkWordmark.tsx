import "../styles/everfolk-wordmark.css";

/** The approved Printed Folktale wordmark, kept as selectable, accessible text. */
export default function EverfolkWordmark({ textured = false, tone = "ink", className = "" }: {
  textured?: boolean;
  tone?: "ink" | "cream";
  className?: string;
}) {
  return <span className={`everfolk-wordmark${textured ? " everfolk-wordmark--textured" : ""}${className ? ` ${className}` : ""}`} data-tone={tone}>
    <span className="everfolk-wordmark-letters">Everfolk</span><span className="everfolk-wordmark-stop">.</span>
  </span>;
}
