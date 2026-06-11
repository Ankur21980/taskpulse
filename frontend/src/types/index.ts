export interface User {
  id: string;
  name: string;
  email: string;
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
  created_at: string;
  updated_at: string;
}

export interface UploadResponse {
  source_id: string;
  task_count: number;
  tasks: Task[];
}
