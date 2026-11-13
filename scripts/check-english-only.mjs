import fs from "node:fs";
import path from "node:path";

// Match specific Vietnamese accented characters using Unicode escape sequences
const VIETNAMESE_REGEX = new RegExp(
  "[\\u0102\\u0103\\u00C2\\u00E2\\u0110\\u0111\\u00CA\\u00EA\\u00D4\\u00F4\\u01A0\\u01A1\\u01AF\\u01B0" +
  "\\u00E0\\u1EA3\\u00E3\\u1EA1\\u1EB1\\u1EB3\\u1EB5\\u1EB7\\u1EA7\\u1EA9\\u1EAB\\u1EAD" +
  "\\u00E8\\u1EBB\\u1EBD\\u1EB9\\u1EC1\\u1EC3\\u1EC5\\u1EC7\\u1EC9\\u0129\\u1ECB" +
  "\\u00F2\\u1ECF\\u00F5\\u1ECD\\u1ED3\\u1ED5\\u1ED7\\u1ED9\\u1EDD\\u1EDF\\u1EE1\\u1EE3" +
  "\\u00F9\\u1EE7\\u0169\\u1EE5\\u1EEB\\u1EED\\u1EEF\\u1EF1\\u1EF3\\u1EF7\\u1EF9\\u1EF5" +
  "\\u00C0\\u1EA2\\u00C3\\u1EA0\\u1EB0\\u1EB2\\u1EB4\\u1EB6\\u1EA6\\u1EA8\\u1EAA\\u1EAC" +
  "\\u00C8\\u1EBA\\u1EBC\\u1EB8\\u1EC0\\u1EC2\\u1EC4\\u1EC6\\u1EC8\\u0128\\u1ECA" +
  "\\u00D2\\u1ECE\\u00D5\\u1ECC\\u1ED2\\u1ED4\\u1ED6\\u1ED8\\u1EDC\\u1EDE\\u1EE0\\u1EE2" +
  "\\u00D9\\u1EE6\\u0168\\u1EE4\\u1EEA\\u1EEC\\u1EEE\\u1EF0\\u1EF2\\u1EF6\\u1EF8\\u1EF4]",
  "u"
);

const IGNORE_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "artifacts", "target", ".cache", ".sites-runtime", ".sites-checkout", ".venv",
  ".next", ".vinext", ".wrangler",
  "artwork", "tools", "research", "docs"
]);
const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css",
  ".md", ".yml", ".yaml", ".toml", ".rs", ".txt", ".sh", ".py", ".svg"
]);

const violations = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      try {
        const content = fs.readFileSync(full, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (VIETNAMESE_REGEX.test(lines[i])) {
            violations.push({
              file: path.relative(process.cwd(), full),
              line: i + 1,
              snippet: lines[i].trim()
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

scanDir(process.cwd());

if (violations.length > 0) {
  console.error(`\x1b[31m[ERROR] Found ${violations.length} line(s) containing Vietnamese characters:\x1b[0m`);
  for (const v of violations) {
    console.error(`  - \x1b[33m${v.file}:${v.line}\x1b[0m -> ${v.snippet.slice(0, 120)}`);
  }
  console.error("\x1b[31mEnglish only is required across all project files.\x1b[0m");
  process.exit(1);
} else {
  console.log("\x1b[32m✔ Language check passed: All text and source files are in English.\x1b[0m");
}
