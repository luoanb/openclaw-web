export type TaskStatus = "active" | "done";

export interface QuickTask {
  id: string;
  content: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface QuickNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickNotesStore {
  tasks: QuickTask[];
  notes: QuickNote[];
}

export type QuickNotesTab = "tasks" | "notes";
