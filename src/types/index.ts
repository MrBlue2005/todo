export type TaskCategory = "task" | "property" | "report" | "campaign" | "reminder";
export type Priority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "todo" | "completed" | "cancelled";
export type PropertyStatus = "new" | "active" | "paused" | "sold_closed" | "archived";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
}

export interface TaskReminder {
  id: string;
  taskId: string;
  remindAt: string;
  offsetMinutes: number | null;
  sentAt: string | null;
}

export interface Task {
  id: string;
  userId: string;
  propertyId: string | null;
  campaignId: string | null;
  title: string;
  description: string;
  category: TaskCategory;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  dueTime: string | null;
  recurrence: RecurrenceRule | null;
  reminders: TaskReminder[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  userId: string;
  name: string;
  address: string;
  description: string;
  status: PropertyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  propertyId: string;
  templateId: string;
  name: string;
  status: "active" | "completed" | "cancelled";
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDraft {
  title: string;
  description?: string;
  propertyId?: string | null;
  campaignId?: string | null;
  category?: TaskCategory;
  priority?: Priority;
  dueDate?: string;
  dueTime?: string | null;
  recurrence?: RecurrenceRule | null;
  reminderOffset?: number | null;
}
