import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export function engineBinaryName() {
  return process.platform === "win32" ? "digipet-engine.exe" : "digipet-engine";
}

export function enginePath(resourceDir) {
  return path.join(resourceDir, "native", engineBinaryName());
}

function cargoCmd() {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const named = process.platform === "win32" ? "cargo.exe" : "cargo";
  const local = path.join(home, ".cargo", "bin", named);
  if (fs.existsSync(local)) return local;
  return "cargo";
}

export function ensureEngineBuilt(rootDir, destPath) {
  if (fs.existsSync(destPath)) return destPath;
  const crate = path.join(rootDir, "native", "engine");
  if (!fs.existsSync(path.join(crate, "Cargo.toml"))) {
    throw new Error("Rust motoru kaynağı yok (native/engine).");
  }
  execFileSync(cargoCmd(), ["build", "--release"], { cwd: crate, stdio: "inherit" });
  const built = path.join(crate, "target", "release", engineBinaryName());
  if (!fs.existsSync(built)) throw new Error("cargo digipet-engine üretmedi");
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(built, destPath);
  if (process.platform !== "win32") fs.chmodSync(destPath, 0o755);
  return destPath;
}

export class EngineHost {
  constructor() {
    this.proc = null;
    this.pending = new Map();
    this.nextId = 1;
    this.onProgress = null;
    this.boot = null;
  }

  start(bin, cacheDir, mcps) {
    if (this.boot) return this.boot;
    this.boot = this.spawn(bin, cacheDir, mcps).catch((err) => {
      this.boot = null;
      throw err;
    });
    return this.boot;
  }

  spawn(bin, cacheDir, mcps) {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.proc = spawn(bin, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.proc.stderr.on("data", (buf) => {
      const line = String(buf).trim();
      if (line) console.error("[engine]", line);
    });
    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on("line", (line) => this.onLine(line));
    this.proc.on("exit", () => {
      this.boot = null;
      for (const [, job] of this.pending) job.reject(new Error("Rust motoru kapandı"));
      this.pending.clear();
      this.proc = null;
    });
    return this.send("init", { cacheDir, mcps });
  }

  stop() {
    this.boot = null;
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
  }

  onLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.event === "progress") {
      this.onProgress?.(msg.pct ?? 0, msg.label ?? "");
      return;
    }
    const job = this.pending.get(msg.id);
    if (!job) return;
    if (msg.event === "progress") return;
    this.pending.delete(msg.id);
    if (msg.ok === false && msg.event === "error") job.reject(new Error(msg.text || "motor hatası"));
    else job.resolve(msg);
  }

  send(cmd, extra = {}) {
    if (!this.proc || !this.proc.stdin.writable) {
      return Promise.reject(new Error("Rust motoru çalışmıyor. npm run build:native (Rust/cargo gerekir)."));
    }
    const id = String(this.nextId++);
    const payload = { id, cmd, ...extra };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("motor zaman aşımı"));
        }
      }, cmd === "init" ? 300000 : 120000);
    });
  }

  catalog() {
    return this.send("catalog").then((msg) => msg.items ?? []);
  }

  setMcps(mcps) {
    return this.send("set-mcps", { mcps });
  }

  reset() {
    return this.send("reset");
  }

  chat(opts) {
    return this.send("chat", opts).then((msg) => msg.text ?? "…");
  }
}
