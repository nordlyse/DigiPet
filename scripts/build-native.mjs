import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cargoHome = process.env.HOME || process.env.USERPROFILE || "";
const cargo =
  process.platform === "win32"
    ? path.join(cargoHome, ".cargo", "bin", "cargo.exe")
    : path.join(cargoHome, ".cargo", "bin", "cargo");
const cargoBin = fs.existsSync(cargo) ? cargo : "cargo";
const crate = path.join(root, "native", "engine");
const exe = process.platform === "win32" ? "digipet-engine.exe" : "digipet-engine";
const dest = path.join(root, "native", exe);

execFileSync(cargoBin, ["build", "--release"], { cwd: crate, stdio: "inherit" });
const built = path.join(crate, "target", "release", exe);
if (!fs.existsSync(built)) {
  throw new Error("cargo did not produce " + exe);
}
fs.copyFileSync(built, dest);
if (process.platform !== "win32") fs.chmodSync(dest, 0o755);
console.log("built", dest);

if (process.platform === "darwin") {
  const bin = path.join(root, "native", "list-windows");
  const src = path.join(root, "native", "list-windows.c");
  execFileSync("clang", ["-O2", "-o", bin, src, "-framework", "CoreGraphics", "-framework", "CoreFoundation"], {
    stdio: "inherit",
  });
  fs.chmodSync(bin, 0o755);
  console.log("built", bin);
}
