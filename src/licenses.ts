import type { McpItem } from "./engine/types";

export const DIGIPET_LICENSE_SHORT = "DigiPet MIT © 2026 Jakob Lyse";

export function agentLicenseSummary(items: McpItem[], selectedIds: string[]): { count: number; text: string } {
  const picked = items.filter((item) => selectedIds.includes(item.id));
  if (picked.length === 0) {
    return {
      count: 0,
      text: `${DIGIPET_LICENSE_SHORT}. Ek üçüncü parti yardımcı yok.`,
    };
  }
  const lines = picked.map((item) => `${item.title} (${item.license})`);
  if (picked.length === 1) {
    return {
      count: 1,
      text: `${DIGIPET_LICENSE_SHORT}. Ek yardımcı: ${lines[0]}.`,
    };
  }
  return {
    count: picked.length,
    text: `Dikkat: ${picked.length} üçüncü parti yardımcı yüklenecek. Hepsinin lisansı ayrı ayrı ve aynı anda geçerlidir — ${lines.join("; ")}. DigiPet MIT bu lisansların yerine geçmez.`,
  };
}
