import type { McpItem } from "./engine/types";
import { t } from "../electron/i18n.mjs";

export const DIGIPET_LICENSE_SHORT = "DigiPet MIT © 2026 Jakob Lyse";

export function agentLicenseSummary(items: McpItem[], selectedIds: string[]): { count: number; text: string } {
  const picked = items.filter((item) => selectedIds.includes(item.id));
  if (picked.length === 0) {
    return {
      count: 0,
      text: `${DIGIPET_LICENSE_SHORT}. ${t("licenseNone")}`,
    };
  }
  const lines = picked.map((item) => `${item.title} (${item.license})`);
  if (picked.length === 1) {
    return {
      count: 1,
      text: `${DIGIPET_LICENSE_SHORT}. ${t("licenseOne")} ${lines[0]}.`,
    };
  }
  return {
    count: picked.length,
    text: `${t("licenseMany")} ${lines.join("; ")}. ${t("licenseTail")}`,
  };
}
