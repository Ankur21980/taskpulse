import type { SourceSummary, Task, TaskCreatePayload, UploadResponse, User } from "../types";

const BASE = "/api";

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: string };
    if (body.detail) return body.detail;
  } catch {
    // not JSON
  }
  return text || res.statusText;
}

function appendEligibleIds(form: FormData, eligibleMemberIds: string[]) {
  form.append("eligible_member_ids", JSON.stringify(eligibleMemberIds));
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export const api = {
  uploadText: (text: string, eligibleMemberIds: string[]) => {
    const form = new FormData();
    form.append("text", text);
    appendEligibleIds(form, eligibleMemberIds);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  uploadFile: (file: File, eligibleMemberIds: string[]) => {
    const form = new FormData();
    form.append("file", file);
    appendEligibleIds(form, eligibleMemberIds);
    return request<UploadResponse>("/sources/upload", { method: "POST", body: form });
  },

  uploadPrd: (file: File, eligibleMemberIds: string[]) => {
    const form = new FormData();
    form.append("file", file);
    appendEligibleIds(form, eligibleMemberIds);
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

  getSourceTasks: (sourceId: string) =>
    request<Task[]>(`/sources/${sourceId}/tasks`),

  listSources: () => request<SourceSummary[]>("/sources"),

  getSource: (id: string) => request<SourceSummary>(`/sources/${id}`),

  updateReviewStatus: (id: string, review_status: "draft" | "completed") =>
    request<SourceSummary>(`/sources/${id}/review-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status }),
    }),

  createTaskOnSource: (sourceId: string, data: TaskCreatePayload) =>
    request<Task>(`/sources/${sourceId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
