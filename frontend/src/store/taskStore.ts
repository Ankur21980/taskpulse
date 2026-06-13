import { create } from "zustand";
import type { SourceSummary, Task, TaskCreatePayload, User } from "../types";
import { api } from "../api/client";

const SOURCE_ID_KEY = "taskpulse:lastSourceId";

function saveSourceId(id: string) {
  sessionStorage.setItem(SOURCE_ID_KEY, id);
}

function loadSourceId(): string | null {
  return sessionStorage.getItem(SOURCE_ID_KEY);
}

interface TaskStore {
  tasks: Task[];
  members: User[];
  sources: SourceSummary[];
  activeSource: SourceSummary | null;
  sourceId: string | null;
  loading: boolean;
  error: string | null;
  toast: string | null;
  setToast: (msg: string | null) => void;
  loadMembers: () => Promise<void>;
  loadSources: () => Promise<void>;
  selectSource: (sourceId: string) => Promise<void>;
  updateReviewStatus: (sourceId: string, status: "draft" | "completed") => Promise<void>;
  addTaskToSource: (sourceId: string, data: TaskCreatePayload) => Promise<void>;
  extractFromText: (text: string, eligibleMemberIds: string[]) => Promise<void>;
  extractFromFile: (file: File, eligibleMemberIds: string[]) => Promise<void>;
  extractFromPrd: (file: File, eligibleMemberIds: string[]) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  assignTask: (id: string, assigneeId: string) => Promise<void>;
  assignAllTasks: (
    items: { taskId: string; assigneeId: string }[]
  ) => Promise<{ succeeded: number; failed: number }>;
  deleteTask: (id: string) => Promise<void>;
  loadAssigneeTasks: (userId: string) => Promise<Task[]>;
  loadTasksForSource: (sourceId: string) => Promise<void>;
  restoreLastSession: () => Promise<void>;
}

async function refreshActiveSource(
  sourceId: string | null,
  set: (partial: Partial<TaskStore>) => void,
  get: () => TaskStore
) {
  if (!sourceId) return;
  try {
    const activeSource = await api.getSource(sourceId);
    const sources = get().sources.map((s) => (s.id === sourceId ? activeSource : s));
    set({ activeSource, sources });
  } catch {
    // keep existing activeSource on refresh failure
  }
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  members: [],
  sources: [],
  activeSource: null,
  sourceId: null,
  loading: false,
  error: null,
  toast: null,

  setToast: (msg) => set({ toast: msg }),

  loadMembers: async () => {
    try {
      const members = await api.getTeamMembers();
      set({ members, error: null });
    } catch (e) {
      set({
        members: [],
        error:
          (e as Error).message ||
          "Could not load team members. Check VITE_API_URL and backend CORS_ORIGINS, then redeploy.",
      });
    }
  },

  loadSources: async () => {
    const sources = await api.listSources();
    const { sourceId, activeSource } = get();
    const active = sourceId ? sources.find((s) => s.id === sourceId) ?? activeSource : null;
    set({ sources, activeSource: active });
  },

  selectSource: async (sourceId) => {
    await get().loadTasksForSource(sourceId);
    const activeSource = await api.getSource(sourceId);
    set({ activeSource });
  },

  updateReviewStatus: async (sourceId, status) => {
    const updated = await api.updateReviewStatus(sourceId, status);
    set({
      sources: get().sources.map((s) => (s.id === sourceId ? updated : s)),
      activeSource: get().activeSource?.id === sourceId ? updated : get().activeSource,
      toast: status === "completed" ? "Review marked complete" : "Review reopened",
    });
  },

  addTaskToSource: async (sourceId, data) => {
    const task = await api.createTaskOnSource(sourceId, data);
    if (get().sourceId === sourceId) {
      set({ tasks: [...get().tasks, task] });
    }
    await get().loadSources();
    set({ toast: "Task added" });
  },

  extractFromText: async (text, eligibleMemberIds) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadText(text, eligibleMemberIds);
      saveSourceId(res.source_id);
      const activeSource = await api.getSource(res.source_id);
      set({
        tasks: res.tasks,
        sourceId: res.source_id,
        activeSource,
        loading: false,
      });
      await get().loadSources();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  extractFromFile: async (file, eligibleMemberIds) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadFile(file, eligibleMemberIds);
      saveSourceId(res.source_id);
      const activeSource = await api.getSource(res.source_id);
      set({
        tasks: res.tasks,
        sourceId: res.source_id,
        activeSource,
        loading: false,
      });
      await get().loadSources();
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  extractFromPrd: async (file, eligibleMemberIds) => {
    set({ loading: true, error: null });
    try {
      const res = await api.uploadPrd(file, eligibleMemberIds);
      saveSourceId(res.source_id);
      const activeSource = await api.getSource(res.source_id);
      set({
        tasks: res.tasks,
        sourceId: res.source_id,
        activeSource,
        loading: false,
      });
      if (res.truncated) {
        set({ toast: "PRD was truncated to fit processing limits." });
      }
      await get().loadSources();
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
    await refreshActiveSource(get().sourceId, set, get);
    await get().loadSources();
  },

  assignAllTasks: async (items) => {
    let succeeded = 0;
    let failed = 0;
    const results = await Promise.allSettled(
      items.map((item) => api.assignTask(item.taskId, item.assigneeId))
    );
    const updatedById = new Map<string, Task>();
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeeded += 1;
        updatedById.set(items[i].taskId, result.value);
      } else {
        failed += 1;
      }
    });
    if (updatedById.size > 0) {
      set({
        tasks: get().tasks.map((t) => updatedById.get(t.id) ?? t),
      });
    }
    await refreshActiveSource(get().sourceId, set, get);
    await get().loadSources();
    return { succeeded, failed };
  },

  deleteTask: async (id) => {
    await api.deleteTask(id);
    set({ tasks: get().tasks.filter((t) => t.id !== id) });
    await refreshActiveSource(get().sourceId, set, get);
    await get().loadSources();
  },

  loadAssigneeTasks: async (userId) => {
    return api.getTasksByAssignee(userId);
  },

  loadTasksForSource: async (sourceId) => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.getSourceTasks(sourceId);
      const activeSource = await api.getSource(sourceId);
      set({ tasks, sourceId, activeSource, loading: false });
      saveSourceId(sourceId);
    } catch (e) {
      sessionStorage.removeItem(SOURCE_ID_KEY);
      set({
        loading: false,
        error: (e as Error).message,
        sourceId: null,
        tasks: [],
        activeSource: null,
      });
    }
  },

  restoreLastSession: async () => {
    const sourceId = loadSourceId();
    if (sourceId && get().tasks.length === 0) {
      await get().loadTasksForSource(sourceId);
    }
  },
}));
