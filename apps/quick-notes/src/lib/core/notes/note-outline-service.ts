export type NoteOutlineLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface NoteOutlineItem {
  id: string;
  index: number;
  level: NoteOutlineLevel;
  text: string;
}

export class NoteOutlineService {
  private static readonly headingPattern = /^(#{1,6})[ \t]+(.+?)\s*#*\s*$/;

  static extract(markdown: string): NoteOutlineItem[] {
    const items: NoteOutlineItem[] = [];

    markdown.split(/\r?\n/).forEach((line) => {
      const match = line.match(NoteOutlineService.headingPattern);

      if (!match) {
        return;
      }

      const marker = match[1];
      const text = match[2]?.trim();

      if (!marker || !text) {
        return;
      }

      items.push({
        id: `heading-${items.length}`,
        index: items.length,
        level: marker.length as NoteOutlineLevel,
        text,
      });
    });

    return items;
  }
}
