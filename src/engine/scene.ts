import type { Platform } from "./types";

export type SceneKind = "video" | "mail" | "music" | "code" | "chat" | "generic";

export function sceneOf(p: Platform): SceneKind {
  const s = `${p.app ?? ""} ${p.title}`.toLowerCase();
  if (/youtube|youtu\.be|netflix|twitch|vimeo|prime video|disney\+|disney plus|\bvlc\b|\biina\b|quicktime|\bplex\b|movies & tv|media player/.test(s)) {
    return "video";
  }
  if (/\b(mail|outlook|spark|airmail|thunderbird|gmail|proton mail|yahoo mail)\b/.test(s)) return "mail";
  if (/spotify|apple music|itunes|\bmusic\b|cider|deezer|soundcloud/.test(s)) return "music";
  if (/slack|discord|telegram|whatsapp|messages|mesajlar|zoom|teams|skype/.test(s)) return "chat";
  if (/cursor|visual studio code|vscode|\bxcode\b|terminal|iterm|warp|sublime/.test(s)) return "code";
  return "generic";
}

export function findScene(windows: Platform[], kind: SceneKind) {
  return windows.find((w) => !w.isFloor && sceneOf(w) === kind) ?? null;
}
