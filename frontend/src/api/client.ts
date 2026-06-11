import type { Task, UploadResponse, User } from "../types";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json();
}

export const api = {
  uploadText: (text: string) => {
    const form = new FormData();
    form.append("text", text);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  getTeamMembers: () => request<User[]>("/teams/demo/members"),

  updateTask: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  assignTask: (id: string, assigneeId: string) =>
    request<Task>(`/tasks/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignee_id: assigneeId }),
    }),

  deleteTask: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  getTasksByAssignee: (userId: string) =>
    request<Task[]>(`/tasks/by-assignee/${userId}`),
};
