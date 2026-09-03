import type { NativeWindow, Platform, WorkArea } from "./types";

export const FLOOR: Platform = {
  id: "floor",
  title: "Masaüstü",
  minX: 0,
  maxX: 1920,
  topY: 1000,
  isFloor: true,
};

export function platformsFromWindows(
  windows: NativeWindow[],
  workArea: WorkArea,
  overlay: { x: number; y: number; width: number; height: number },
): Platform[] {
  FLOOR.minX = workArea.x - overlay.x + 8;
  FLOOR.maxX = workArea.x - overlay.x + workArea.width - 8;
  FLOOR.topY = workArea.y - overlay.y + workArea.height - 6;

  const platforms: Platform[] = [FLOOR];
  const seen = new Set<string>();

  for (const win of windows) {
    const localX = win.x - overlay.x;
    const localY = win.y - overlay.y;
    if (localX + win.w < 40 || localX > overlay.width - 40) continue;
    if (localY > overlay.height - 80) continue;

    const topY = localY + 2;
    if (topY > FLOOR.topY - 70) continue;

    const id = `win-${win.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    platforms.push({
      id,
      title: win.title || win.app,
      minX: localX + 18,
      maxX: localX + win.w - 18,
      topY,
    });
  }

  return platforms;
}

export function platformAt(platforms: Platform[], x: number, y: number): Platform | null {
  let best: Platform | null = null;
  let bestTop = -Infinity;
  for (const p of platforms) {
    if (x < p.minX - 24 || x > p.maxX + 24) continue;
    if (y + 28 < p.topY) continue;
    if (p.topY >= bestTop) {
      best = p;
      bestTop = p.topY;
    }
  }
  return best;
}
