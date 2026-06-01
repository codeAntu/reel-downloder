import { readFileSync } from "fs";

export function extractLinksFromChat(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const links = new Set<string>();
  const urlRegex = /(https:\/\/[^\s]+)/g;

  for (const line of lines) {
    const matches = line.match(urlRegex);
    if (!matches) continue;

    for (const url of matches) {
      const cleanUrl = url.replace(/[\s,\)]*$/, "");
      if (
        cleanUrl.includes("instagram.com") ||
        cleanUrl.includes("facebook.com")
      ) {
        links.add(cleanUrl);
      }
    }
  }

  return Array.from(links);
}

export function isValidSocialLink(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname.includes("instagram.com") ||
      urlObj.hostname.includes("facebook.com")
    );
  } catch {
    return false;
  }
}
