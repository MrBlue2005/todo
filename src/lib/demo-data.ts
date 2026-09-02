import { addDays, format } from "date-fns";
import type { Campaign, Property, Task } from "@/types";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");
const now = new Date().toISOString();

export const demoProperties: Property[] = [
  { id: "prop-one", userId: "demo", name: "ONE Herastrau Residence", address: "Strada Nicolae G. Caramfil 74A, Bucharest", description: "Premium two-bedroom residence overlooking Herastrau.", status: "active", createdAt: now, updatedAt: now },
  { id: "prop-villa", userId: "demo", name: "Iancu Nicolae Villa", address: "Erou Iancu Nicolae, Voluntari", description: "Private family villa with garden and pool.", status: "active", createdAt: now, updatedAt: now },
  { id: "prop-primaverii", userId: "demo", name: "Primaverii Residence", address: "Bulevardul Primaverii, Bucharest", description: "New off-market residence in a prime diplomatic quarter.", status: "new", createdAt: now, updatedAt: now },
];

export const demoTasks: Task[] = [
  { id: "task-report", userId: "demo", propertyId: "prop-one", campaignId: null, title: "Monthly property report", description: "Prepare the owner-facing activity and performance update.", category: "report", priority: "high", status: "todo", dueDate: day(0), dueTime: "17:00", recurrence: { frequency: "monthly", interval: 1 }, reminders: [], completedAt: null, createdAt: now, updatedAt: now },
  { id: "task-owner", userId: "demo", propertyId: "prop-villa", campaignId: null, title: "Call owner regarding price adjustment", description: "Review current interest before the call.", category: "property", priority: "urgent", status: "todo", dueDate: day(-1), dueTime: "10:30", recurrence: null, reminders: [], completedAt: null, createdAt: now, updatedAt: now },
  { id: "task-meta", userId: "demo", propertyId: "prop-one", campaignId: "campaign-one", title: "Check Meta campaign performance", description: "Compare enquiries and cost per lead against launch targets.", category: "campaign", priority: "normal", status: "todo", dueDate: day(0), dueTime: "14:00", recurrence: null, reminders: [], completedAt: null, createdAt: now, updatedAt: now },
  { id: "task-description", userId: "demo", propertyId: "prop-primaverii", campaignId: null, title: "Update property description", description: "Add the revised amenities and positioning copy.", category: "property", priority: "normal", status: "todo", dueDate: day(1), dueTime: null, recurrence: null, reminders: [], completedAt: null, createdAt: now, updatedAt: now },
  { id: "task-photos", userId: "demo", propertyId: "prop-villa", campaignId: null, title: "Upload new photographs", description: "Replace the twilight exterior set.", category: "property", priority: "low", status: "completed", dueDate: day(0), dueTime: null, recurrence: null, reminders: [], completedAt: now, createdAt: now, updatedAt: now },
];

export const demoCampaigns: Campaign[] = [
  { id: "campaign-one", userId: "demo", propertyId: "prop-one", templateId: "new-property", name: "New Property Launch", status: "active", startDate: day(-3), createdAt: now, updatedAt: now },
];
