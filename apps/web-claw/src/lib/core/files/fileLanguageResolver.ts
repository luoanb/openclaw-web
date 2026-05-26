const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  [".css", "CSS"],
  [".html", "HTML"],
  [".js", "JavaScript"],
  [".json", "JSON"],
  [".jsx", "JavaScript JSX"],
  [".md", "Markdown"],
  [".mjs", "JavaScript"],
  [".py", "Python"],
  [".sh", "Shell"],
  [".svelte", "Svelte"],
  [".ts", "TypeScript"],
  [".tsx", "TypeScript JSX"],
  [".txt", "Text"],
  [".xml", "XML"],
  [".yaml", "YAML"],
  [".yml", "YAML"],
]);

export class FileLanguageResolver {
  static getLabel(path: string): string {
    const extension = FileLanguageResolver.getExtension(path.toLowerCase());
    return LANGUAGE_BY_EXTENSION.get(extension) ?? "Text";
  }

  private static getExtension(path: string): string {
    const fileName = path.split("/").filter(Boolean).at(-1) ?? path;
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) return "";
    return fileName.slice(dotIndex);
  }
}
