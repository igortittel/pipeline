export type Priority = 'low' | 'medium' | 'high';
export type Status = 'Nový' | 'Pracujem na tom' | 'Na kontrole' | 'Hotovo';

export interface Comment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  assignee: string;
  deadline: string;
  assetLinks: string[];
  comments: Comment[];
  createdAt: string;
  order: number;
}

export interface Pipeline {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: string;
}

export interface AppState {
  pipelines: Pipeline[];
  activePipelineId: string | null;
}
