"use client";

import { addDays, format, isSameDay, nextSaturday, parseISO } from "date-fns";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { localDate } from "@/lib/date";
import type { Priority, Property, RecurrenceFrequency, TaskCategory } from "@/types";
import { MobileSheet } from "./mobile-sheet";
import styles from "./task-interactions.module.css";

export type PickerKind = "date" | "time" | "property" | "priority" | "reminder" | "category" | "recurrence";

export interface TaskPickerValues {
  dueDate: string;
  dueTime: string;
  propertyId: string;
  priority: Priority;
  reminder: string;
  category: TaskCategory;
  recurrence: "" | RecurrenceFrequency;
}

export function TaskPickerSheet({
  kind,
  values,
  properties,
  onChange,
  onClose,
}: {
  kind: PickerKind | null;
  values: TaskPickerValues;
  properties: Property[];
  onChange: (patch: Partial<TaskPickerValues>) => void;
  onClose: () => void;
}) {
  if (!kind) return null;
  const titles: Record<PickerKind, string> = {
    date: "Choose date", time: "Choose time", property: "Select property", priority: "Priority",
    reminder: "Reminder", category: "Category", recurrence: "Repeat",
  };
  return (
    <MobileSheet open nested title={titles[kind]} eyebrow="TASK OPTIONS" onClose={onClose} backLabel="Back to task">
      {kind === "date" && <DatePicker value={values.dueDate} onSelect={(dueDate) => { onChange({ dueDate }); onClose(); }} />}
      {kind === "time" && <TimePicker value={values.dueTime} onConfirm={(dueTime) => onChange({ dueTime })} onCancel={onClose} />}
      {kind === "property" && <PropertyPicker properties={properties} value={values.propertyId} onSelect={(propertyId) => { onChange({ propertyId }); onClose(); }} />}
      {kind === "priority" && <OptionList value={values.priority} options={[{ value: "low", label: "Low" }, { value: "normal", label: "Normal", detail: "Default" }, { value: "high", label: "High", tone: "high" }, { value: "urgent", label: "Urgent", tone: "urgent" }]} onSelect={(priority) => { onChange({ priority: priority as Priority }); onClose(); }} />}
      {kind === "reminder" && <ReminderPicker value={values.reminder} hasTime={Boolean(values.dueTime)} onSelect={(reminder) => { onChange({ reminder }); onClose(); }} />}
      {kind === "category" && <OptionList value={values.category} options={[{ value: "task", label: "Task" }, { value: "property", label: "Property" }, { value: "report", label: "Report" }, { value: "campaign", label: "Campaign" }, { value: "reminder", label: "Reminder" }]} onSelect={(category) => { onChange({ category: category as TaskCategory }); onClose(); }} />}
      {kind === "recurrence" && <OptionList value={values.recurrence} options={[{ value: "", label: "None" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} onSelect={(recurrence) => { onChange({ recurrence: recurrence as "" | RecurrenceFrequency }); onClose(); }} />}
    </MobileSheet>
  );
}

function OptionList({ value, options, onSelect }: { value: string; options: Array<{ value: string; label: string; detail?: string; tone?: string; disabled?: boolean }>; onSelect: (value: string) => void }) {
  return <div className={styles.optionList}>{options.map((option) => <button type="button" key={option.value || "none"} disabled={option.disabled} className={`${styles.optionRow} ${option.tone ? styles[option.tone] : ""}`} onClick={() => onSelect(option.value)}><span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>{value === option.value && <Check size={19} />}</button>)}</div>;
}

function DatePicker({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const [custom, setCustom] = useState(false); const today = new Date(); const weekend = nextSaturday(addDays(today, -1));
  const options = [
    { value: localDate(today), label: "Today", detail: format(today, "EEEE, MMMM d") },
    { value: localDate(addDays(today, 1)), label: "Tomorrow", detail: format(addDays(today, 1), "EEEE, MMMM d") },
    { value: localDate(weekend), label: "This weekend", detail: format(weekend, "EEEE, MMMM d") },
    { value: localDate(addDays(today, 7)), label: "Next week", detail: format(addDays(today, 7), "EEEE, MMMM d") },
  ];
  return <><OptionList value={value} options={options} onSelect={onSelect} /><button type="button" className={styles.pickerAction} onClick={() => setCustom(!custom)}>Pick another date</button>{custom && <label className={styles.customField}><span>Date</span><input type="date" value={value} min={localDate()} onChange={(event) => onSelect(event.target.value)} /></label>}</>;
}

function TimePicker({ value, onConfirm, onCancel }: { value: string; onConfirm: (value: string) => void; onCancel: () => void }) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit(time: string) {
    onConfirm(time);
    onCancel();
  }

  return <><OptionList value={draft} options={[{ value: "", label: "No time" }, ...["09:00", "12:00", "15:00", "18:00"].map((time) => ({ value: time, label: time }))]} onSelect={setDraft} /><button type="button" className={styles.pickerAction} onClick={() => setCustom(!custom)}>Custom time</button>{custom && <label className={styles.customField}><span>Time</span><input type="time" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>}
    <div className={styles.timePickerActions}>
      <button type="button" className={styles.pickerCancel} onClick={onCancel}>Cancel</button>
      <button type="button" className={styles.pickerConfirm} onClick={() => commit(draft)}><Check size={17} /> Confirm</button>
    </div></>;
}

function PropertyPicker({ properties, value, onSelect }: { properties: Property[]; value: string; onSelect: (value: string) => void }) {
  const [query, setQuery] = useState(""); const visible = useMemo(() => properties.filter((property) => `${property.name} ${property.address}`.toLowerCase().includes(query.toLowerCase())), [properties, query]);
  return <><label className={styles.search}><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties" /></label><div className={styles.optionList}><button type="button" className={styles.optionRow} onClick={() => onSelect("")}><span><strong>No property</strong><small>General task</small></span>{!value && <Check size={19} />}</button>{visible.map((property) => <button type="button" className={styles.optionRow} key={property.id} onClick={() => onSelect(property.id)}><span><strong>{property.name}</strong><small>{property.address}</small></span>{value === property.id && <Check size={19} />}</button>)}</div></>;
}

function ReminderPicker({ value, hasTime, onSelect }: { value: string; hasTime: boolean; onSelect: (value: string) => void }) {
  const [custom, setCustom] = useState("");
  const options = [{ value: "", label: "No reminder" }, { value: "0", label: "At due time", disabled: !hasTime }, { value: "10", label: "10 minutes before", disabled: !hasTime }, { value: "30", label: "30 minutes before", disabled: !hasTime }, { value: "60", label: "1 hour before", disabled: !hasTime }, { value: "1440", label: "1 day before" }];
  return <><OptionList value={value} options={options} onSelect={onSelect} />{!hasTime && <p className={styles.pickerHint}>Add a time to use same-day or custom reminders. A one-day reminder only needs a date.</p>}<div className={styles.customReminder}><input inputMode="numeric" min="1" type="number" value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Custom minutes before" disabled={!hasTime} /><button type="button" disabled={!hasTime || !custom || Number(custom) < 1} onClick={() => onSelect(custom)}>Set</button></div></>;
}

export function dateLabel(value: string) {
  const date = parseISO(value); const today = new Date();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, addDays(today, 1))) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export const reminderLabel = (value: string) => ({ "": "No reminder", "0": "At due time", "10": "10 min before", "30": "30 min before", "60": "1 hour before", "1440": "1 day before" }[value] ?? `${value} min before`);
export const titleCase = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : "None";
