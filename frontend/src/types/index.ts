export interface User {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  experience_years?: number | null;
}

export interface Task {
  id: string;
  title: string;
  assignee_id: string | null;
  assignee_hint: string | null;
  status: string;
  priority: "high" | "medium" | "low";
  due_date: string | null;
  source_ref_id: string;
  source_quote: string | null;
  feature_area: string | null;
  task_type: "requirement" | "milestone" | "deliverable" | null;
  created_at: string;
  updated_at: string;
}

export interface UploadResponse {
  source_id: string;
  task_count: number;
  tasks: Task[];
  truncated?: boolean;
}

export interface SourceSummary {
  id: string;
  type: string;
  original_filename: string | null;
  created_at: string;
  review_status: "draft" | "completed";
  completed_at: string | null;
  eligible_assignee_ids: string[];
  task_count: number;
  draft_task_count: number;
  assigned_task_count: number;
}

export interface TaskCreatePayload {
  title: string;
  assignee_id?: string | null;
  assignee_hint?: string | null;
  priority?: "high" | "medium" | "low";
  feature_area?: string | null;
  task_type?: "requirement" | "milestone" | "deliverable" | null;
}
