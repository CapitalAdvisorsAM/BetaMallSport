export const LINE_KEY_REGEX = /^(eerr|cdg)\.[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?$/;

export type AnalysisViewLower = "eerr" | "cdg";

function slugifyPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toLineKey(view: AnalysisViewLower, ...parts: string[]): string {
  const slug = parts
    .map(slugifyPart)
    .filter((part) => part.length > 0)
    .join(".");
  return `${view}.${slug}`;
}

export function isValidLineKey(value: string): boolean {
  return LINE_KEY_REGEX.test(value);
}
