"use client";

import { Bell, CalendarDays, ChevronDown, Clock3, FileText, Flag, ListFilter, MapPin, Plus, Repeat2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { localDate } from "@/lib/date";
import type { Priority, RecurrenceFrequency, TaskCategory } from "@/types";
import { MobileSheet, SettingRow } from "@/components/task-interactions/mobile-sheet";
import { dateLabel, reminderLabel, TaskPickerSheet, titleCase, type PickerKind, type TaskPickerValues } from "@/components/task-interactions/task-pickers";
import styles from "@/components/task-interactions/task-interactions.module.css";

export function QuickCreateSheet({ open, onClose, propertyId, defaultDate }: { open: boolean; onClose: () => void; propertyId?: string; defaultDate?: string }) {
  const { createTask, properties } = useApp();
  const [title, setTitle] = useState(""); const [notesOpen, setNotesOpen] = useState(false); const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false); const [picker, setPicker] = useState<PickerKind | null>(null);
  const [form, setForm] = useState({ description: "", propertyId: propertyId ?? "", dueDate: defaultDate ?? localDate(), dueTime: "", category: "task" as TaskCategory, priority: "normal" as Priority, recurrence: "" as "" | RecurrenceFrequency, reminder: "" });
  const property = useMemo(() => properties.find((item) => item.id === form.propertyId), [form.propertyId, properties]);
  const pickerValues: TaskPickerValues = form;

  function applyPicker(patch: Partial<TaskPickerValues>) {
    setForm((current) => ({ ...current, ...patch, reminder: patch.dueTime === "" && ["0", "10", "30", "60"].includes(current.reminder) ? "" : (patch.reminder ?? current.reminder) }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!title.trim()) return; setSaving(true);
    try {
      await createTask({ title, description: form.description, propertyId: form.propertyId || null, dueDate: form.dueDate, dueTime: form.dueTime || null, category: form.category, priority: form.priority, recurrence: form.recurrence ? { frequency: form.recurrence, interval: 1 } : null, reminderOffset: form.reminder === "" ? null : Number(form.reminder) });
      onClose();
    } finally { setSaving(false); }
  }

  return <MobileSheet open={open} onClose={onClose} title="New task" eyebrow="QUICK CAPTURE">
    <form className={styles.createForm} onSubmit={submit}>
      <input className={styles.titleInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" autoFocus maxLength={180} aria-label="Task title" />
      {(notesOpen || form.description) ? <textarea className={styles.notesInput} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add context or a note…" rows={3} autoFocus={notesOpen && !title} aria-label="Task notes" /> : <button type="button" className={`${styles.addNotes} min-h-11`} onClick={() => setNotesOpen(true)}><FileText size={16} /> Add notes</button>}

      <div className={styles.quickActions} aria-label="Task options">
        <button type="button" className={`${styles.quickChip} min-h-11`} onClick={() => setPicker("date")}><CalendarDays size={17} /><span>{dateLabel(form.dueDate)}</span></button>
        <button type="button" className={`${styles.quickChip} ${!form.dueTime ? styles.quietChip : ""} min-h-11`} onClick={() => setPicker("time")}><Clock3 size={17} /><span>{form.dueTime || "Add time"}</span></button>
        <button type="button" className={`${styles.quickChip} ${!property ? styles.quietChip : ""} min-h-11`} onClick={() => setPicker("property")}><MapPin size={17} /><span>{property?.name ?? "Property"}</span></button>
        <button type="button" className={`${styles.quickChip} ${form.priority === "normal" ? styles.quietChip : styles[form.priority]} min-h-11`} onClick={() => setPicker("priority")}><Flag size={17} /><span>{titleCase(form.priority)}</span></button>
        <button type="button" className={`${styles.quickChip} ${!form.reminder ? styles.quietChip : ""} min-h-11`} onClick={() => setPicker("reminder")}><Bell size={17} /><span>{form.reminder ? reminderLabel(form.reminder) : "Reminder"}</span></button>
      </div>

      <button type="button" className={styles.moreToggle} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}><span>More options</span><ChevronDown size={17} className={moreOpen ? styles.rotated : ""} /></button>
      {moreOpen && <div className={styles.settingRows}>
        <SettingRow icon={<ListFilter size={18} />} label="Category" value={titleCase(form.category)} onClick={() => setPicker("category")} />
        <SettingRow icon={<Repeat2 size={18} />} label="Repeat" value={titleCase(form.recurrence)} onClick={() => setPicker("recurrence")} />
      </div>}

      <div className={styles.stickyAction}><button className={styles.addButton} disabled={!title.trim() || saving}><Plus size={18} />{saving ? "Adding…" : "Add Task"}</button></div>
    </form>
    <TaskPickerSheet kind={picker} values={pickerValues} properties={properties} onChange={applyPicker} onClose={() => setPicker(null)} />
  </MobileSheet>;
}
