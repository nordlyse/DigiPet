import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (process.platform !== "darwin") {
  console.log("native helper is macOS-only; skipping");
  process.exit(0);
}

const bin = path.join(root, "native", "list-windows");
const src = path.join(root, "native", "list-windows.c");
execFileSync(
  "clang",
  ["-O2", "-o", bin, src, "-framework", "CoreGraphics", "-framework", "CoreFoundation"],
  { stdio: "inherit" },
);
fs.chmodSync(bin, 0o755);
console.log("built", bin);
