export class BrowserPodFilePath {
  static normalize(path: string): string {
    const trimmed = path.trim();
    const absolute = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const parts: string[] = [];

    for (const part of absolute.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        parts.pop();
        continue;
      }
      parts.push(part);
    }

    return `/${parts.join("/")}`;
  }

  static dirname(path: string): string {
    const normalized = BrowserPodFilePath.normalize(path);
    const index = normalized.lastIndexOf("/");
    if (index <= 0) return "/";
    return normalized.slice(0, index);
  }

  static basename(path: string): string {
    const normalized = BrowserPodFilePath.normalize(path);
    if (normalized === "/") return "/";
    return normalized.slice(normalized.lastIndexOf("/") + 1);
  }

  static join(parentPath: string, name: string): string {
    const parent = BrowserPodFilePath.normalize(parentPath);
    return BrowserPodFilePath.normalize(`${parent === "/" ? "" : parent}/${name}`);
  }

  static copyName(path: string, index = 1): string {
    const normalized = BrowserPodFilePath.normalize(path);
    const suffix = index <= 1 ? "_copy" : `_copy_${index}`;
    if (normalized === "/") return `/${suffix.slice(1)}`;
    return BrowserPodFilePath.join(BrowserPodFilePath.dirname(normalized), `${BrowserPodFilePath.basename(normalized)}${suffix}`);
  }

  static shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
