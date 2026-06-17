import type { QuickNote } from "../quick-notes-types";

const SUMMARY_LIMIT = 72;

export class NoteService {
  static createNote(notes: QuickNote[], content: string, now: string): QuickNote[] {
    const normalizedContent = NoteService.normalizeContent(content);

    if (!normalizedContent) {
      return notes;
    }

    return [
      {
        id: NoteService.createId(),
        content: normalizedContent,
        createdAt: now,
        updatedAt: now,
        pinnedAt: null,
      },
      ...notes,
    ];
  }

  static updateNoteContent(
    notes: QuickNote[],
    noteId: string,
    content: string,
    now: string
  ): QuickNote[] {
    const normalizedContent = NoteService.normalizeContent(content);

    if (!normalizedContent) {
      return notes;
    }

    return notes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            content: normalizedContent,
            updatedAt: now,
          }
        : note
    );
  }

  static deleteNote(notes: QuickNote[], noteId: string): QuickNote[] {
    return notes.filter((note) => note.id !== noteId);
  }

  static pinNote(notes: QuickNote[], noteId: string, now: string): QuickNote[] {
    return notes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            pinnedAt: now,
          }
        : note
    );
  }

  static unpinNote(notes: QuickNote[], noteId: string): QuickNote[] {
    return notes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            pinnedAt: null,
          }
        : note
    );
  }

  static getNotes(notes: QuickNote[], query: string): QuickNote[] {
    const normalizedQuery = query.trim().toLowerCase();
    const sortedNotes = [...notes].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );

    if (!normalizedQuery) {
      return sortedNotes;
    }

    return sortedNotes.filter((note) => {
      const title = NoteService.getNoteTitle(note).toLowerCase();
      const summary = NoteService.getNoteSummary(note).toLowerCase();
      const content = note.content.toLowerCase();

      return (
        title.includes(normalizedQuery) ||
        summary.includes(normalizedQuery) ||
        content.includes(normalizedQuery)
      );
    });
  }

  static getPinnedNotes(notes: QuickNote[], query: string): QuickNote[] {
    return NoteService.filterNotes(notes, query)
      .filter((note) => Boolean(note.pinnedAt))
      .sort((left, right) => NoteService.compareDesc(left.pinnedAt ?? "", right.pinnedAt ?? ""));
  }

  static getNoteTitle(note: QuickNote): string {
    return NoteService.getFirstLine(note.content) || "未命名速记";
  }

  static getNoteSummary(note: QuickNote): string {
    const firstLine = NoteService.getFirstLine(note.content);

    if (firstLine.length <= SUMMARY_LIMIT) {
      return firstLine;
    }

    return `${firstLine.slice(0, SUMMARY_LIMIT)}...`;
  }

  static pickNextNoteId(notes: QuickNote[], deletedNoteId: string): string | null {
    const sortedNotes = NoteService.getNotes(notes, "");
    const deletedIndex = sortedNotes.findIndex((note) => note.id === deletedNoteId);
    const nextNote = sortedNotes[deletedIndex + 1] ?? sortedNotes[deletedIndex - 1] ?? sortedNotes[0];

    return nextNote?.id ?? null;
  }

  private static getFirstLine(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  }

  private static normalizeContent(content: string): string {
    return content.trim();
  }

  private static filterNotes(notes: QuickNote[], query: string): QuickNote[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return notes;
    }

    return notes.filter((note) => {
      const title = NoteService.getNoteTitle(note).toLowerCase();
      const summary = NoteService.getNoteSummary(note).toLowerCase();
      const content = note.content.toLowerCase();

      return (
        title.includes(normalizedQuery) ||
        summary.includes(normalizedQuery) ||
        content.includes(normalizedQuery)
      );
    });
  }

  private static compareDesc(left: string, right: string): number {
    return right.localeCompare(left);
  }

  private static createId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
