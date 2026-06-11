import { create } from "zustand";
import type { Task, User } from "../types";
import { api } from "../api/client";

interface TaskStore {
  tasks: Task[];
  members: User[];
  sourceId: string | null;
  loading: boolean;
  error: string | null;
  toast: string | null;
  setToast: (msg: string | null) => void;
  loadMembers: () => Promise<void>;
  extractFromText: (text: string) => Promise<void>;
  extractFromFile: (file: File) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  assignTask: (id: string, assigneeId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  loadAssigneeTasks: (userId: string) => Promise<Task[]>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  members: [],
  sourceId: null,
  loading: false,
  error: null,
  toast: null,

  setToast: (msg) => set({ toast: msg }),

  loadMembers: async () => {
    const members = await api.getTeamMembers();
    set({ members });
  },

  extractFromText: async (text) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadText(text);
      set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  extractFromFile: async (file) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadFile(file);
      set({ tasks: res.tasks, sourceId: res.source_id, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  updateTask: async (id, data) => {
    const updated = await api.updateTask(id, data);
    set({
      tasks: get().tasks.map((t) => (t.id === id ? updated : t)),
    });
  },

  assignTask: async (id, assigneeId) => {
    const updated = await api.assignTask(id, assigneeId);
    const member = get().members.find((m) => m.id === assigneeId);
    set({
      tasks: get().tasks.map((t) => (t.id === id ? updated : t)),
      toast: `Task assigned to ${member?.name ?? "team member"}`,
    });
  },

  deleteTask: async (id) => {
    await api.deleteTask(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
  },

  loadAssigneeTasks: async (userId) => {
    return api.getTasksByAssignee(userId);
  },
}));
