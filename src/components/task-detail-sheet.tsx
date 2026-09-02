"use client";

import { Bell, CalendarDays, Clock3, Flag, ListFilter, MapPin, Repeat2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import type { Task } from "@/types";
import { MobileSheet, SettingRow } from "@/components/task-interactions/mobile-sheet";
import { dateLabel, reminderLabel, TaskPickerSheet, titleCase, type PickerKind, type TaskPickerValues } from "@/components/task-interactions/task-pickers";
import styles from "@/components/task-interactions/task-interactions.module.css";

export function TaskDetailSheet({ task, open, onClose }: { task: Task; open: boolean; onClose: () => void }) {
  const { properties, updateTask, deleteTask, toggleTask, setTaskReminder } = useApp();
  const [draft, setDraft] = useState(task); const [notesOpen, setNotesOpen] = useState(Boolean(task.description));
  const [reminderOffset, setReminderOffset] = useState(task.reminders[0]?.offsetMinutes?.toString() ?? ""); const [picker, setPicker] = useState<PickerKind | null>(null); const [saving, setSaving] = useState(false);
  const property = useMemo(() => properties.find((item) => item.id === draft.propertyId), [draft.propertyId, properties]);
  const pickerValues: TaskPickerValues = { dueDate: draft.dueDate, dueTime: draft.dueTime ?? "", propertyId: draft.propertyId ?? "", priority: draft.priority, reminder: reminderOffset, category: draft.category, recurrence: draft.recurrence?.frequency ?? "" };

  function applyPicker(patch: Partial<TaskPickerValues>) {
    if (patch.reminder !== undefined) setReminderOffset(patch.reminder);
    if (patch.dueTime === "" && ["0", "10", "30", "60"].includes(reminderOffset)) setReminderOffset("");
    setDraft((current) => ({ ...current,
      dueDate: patch.dueDate ?? current.dueDate,
      dueTime: patch.dueTime !== undefined ? patch.dueTime || null : current.dueTime,
      propertyId: patch.propertyId !== undefined ? patch.propertyId || null : current.propertyId,
      priority: patch.priority ?? current.priority,
      category: patch.category ?? current.category,
      recurrence: patch.recurrence !== undefined ? (patch.recurrence ? { frequency: patch.recurrence, interval: 1 } : null) : current.recurrence,
    }));
  }
  async function save() { if (!draft.title.trim()) return; setSaving(true); try { const taskSaved = await updateTask(task.id, draft); if (!taskSaved) return; const reminderSaved = await setTaskReminder(task.id, reminderOffset === "" ? null : Number(reminderOffset), draft); if (reminderSaved) onClose(); } finally { setSaving(false); } }
  async function remove() { if (confirm(`Delete “${task.title}”? This cannot be undone.`)) { await deleteTask(task.id); onClose(); } }
  async function complete() { await toggleTask(task.id); onClose(); }

  return <MobileSheet open={open} full onClose={onClose} title="Task details" eyebrow={task.status === "completed" ? "COMPLETED" : "OPEN TASK"}>
    <div className={styles.detailTop}>
      <button type="button" className={`${styles.completeButton} ${task.status === "completed" ? styles.completed : ""}`} onClick={() => void complete()} aria-label={task.status === "completed" ? "Reopen task" : "Complete task"}><span /></button>
      <textarea className={styles.detailTitle} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} rows={2} maxLength={180} aria-label="Task title" />
    </div>
    <div className={styles.notesBlock}>{notesOpen || draft.description ? <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Add context or a note…" rows={3} aria-label="Task notes" /> : <button type="button" onClick={() => setNotesOpen(true)}>Add notes</button>}</div>

    <div className={styles.detailRows}>
      <SettingRow icon={<CalendarDays size={18} />} label="Due" value={`${dateLabel(draft.dueDate)}${draft.dueTime ? `, ${draft.dueTime}` : ""}`} onClick={() => setPicker("date")} tone="accent" />
      <SettingRow icon={<Clock3 size={18} />} label="Time" value={draft.dueTime ?? "No time"} onClick={() => setPicker("time")} />
      <SettingRow icon={<MapPin size={18} />} label="Property" value={property?.name ?? "No property"} onClick={() => setPicker("property")} />
      <SettingRow icon={<Bell size={18} />} label="Reminder" value={reminderLabel(reminderOffset)} onClick={() => setPicker("reminder")} />
      <SettingRow icon={<Flag size={18} />} label="Priority" value={titleCase(draft.priority)} onClick={() => setPicker("priority")} tone={draft.priority === "urgent" ? "urgent" : undefined} />
      <SettingRow icon={<Repeat2 size={18} />} label="Repeat" value={titleCase(draft.recurrence?.frequency ?? "")} onClick={() => setPicker("recurrence")} />
      <SettingRow icon={<ListFilter size={18} />} label="Category" value={titleCase(draft.category)} onClick={() => setPicker("category")} />
    </div>

    <div className={styles.detailFooter}>
      <button type="button" className={styles.saveButton} onClick={() => void save()} disabled={!draft.title.trim() || saving}>{saving ? "Saving…" : "Save changes"}</button>
      <button type="button" className={styles.deleteButton} onClick={() => void remove()}><Trash2 size={16} /> Delete task</button>
    </div>
    <TaskPickerSheet kind={picker} values={pickerValues} properties={properties} onChange={applyPicker} onClose={() => setPicker(null)} />
  </MobileSheet>;
}
