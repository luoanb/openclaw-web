export class BrowserPodTerminalPath {
  static resolve(currentCwd: string, input: string): string {
    const target = input.trim() || "/";
    const absolute = target.startsWith("/") ? target : `${currentCwd.replace(/\/$/, "")}/${target}`;
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

  static shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
