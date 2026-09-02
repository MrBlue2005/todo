"use client";

import { format, isTomorrow, parseISO } from "date-fns";
import Link from "next/link";
import { AlertCircle, ChevronRight, MapPin, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { taskBucket } from "@/lib/date";
import type { Property, PropertyStatus, Task } from "@/types";
import styles from "./properties.module.css";

type PropertyFilter = "all" | "attention" | "active" | "clear";

function openTasksFor(property: Property, tasks: Task[]) {
  return tasks.filter((task) => task.propertyId === property.id && task.status === "todo");
}

function needsAttention(tasks: Task[]) {
  return tasks.some((task) => taskBucket(task) === "overdue" || task.priority === "urgent");
}

function nextDeadline(tasks: Task[]) {
  const next = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00"))[0];
  if (!next) return null;
  const bucket = taskBucket(next);
  const date = bucket === "overdue" ? "Overdue" : bucket === "today" ? "Today" : isTomorrow(parseISO(next.dueDate)) ? "Tomorrow" : format(parseISO(next.dueDate), "MMM d");
  return `${date}${next.dueTime ? ` · ${next.dueTime}` : ""}`;
}

export default function PropertiesPage() {
  const { properties, tasks, createProperty, ready } = useApp();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PropertyFilter>("all");
  const [creating, setCreating] = useState(false);
  const activeCount = properties.filter((property) => property.status === "active").length;

  const visible = useMemo(() => properties
    .filter((property) => {
      const open = openTasksFor(property, tasks);
      const matchesFilter = filter === "all"
        || (filter === "attention" && needsAttention(open))
        || (filter === "active" && property.status === "active")
        || (filter === "clear" && open.length === 0);
      return matchesFilter && `${property.name} ${property.address}`.toLowerCase().includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      const aAttention = needsAttention(openTasksFor(a, tasks));
      const bAttention = needsAttention(openTasksFor(b, tasks));
      return Number(bAttention) - Number(aAttention) || a.name.localeCompare(b.name);
    }), [filter, properties, query, tasks]);

  return (
    <div className={`screen ${styles.listScreen}`}>
      <header className={styles.listHeader}>
        <div>
          <h1>Properties</h1>
          <p>{activeCount} active</p>
        </div>
        <button className={styles.addProperty} type="button" onClick={() => setCreating(true)}><Plus size={16} /> Add property</button>
      </header>

      <label className={styles.search}>
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search properties" aria-label="Search properties" />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}
      </label>

      <div className={styles.filters} aria-label="Property filters">
        {([
          ["all", "All"],
          ["attention", "Needs attention"],
          ["active", "Active"],
          ["clear", "No pending tasks"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={filter === value ? styles.filterActive : undefined} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>

      {!ready ? <PropertySkeleton /> : visible.length ? (
        <div className={styles.propertyGroup}>
          {visible.map((property) => {
            const open = openTasksFor(property, tasks);
            const overdue = open.filter((task) => taskBucket(task) === "overdue").length;
            const attention = needsAttention(open);
            const deadline = nextDeadline(open);
            return (
              <Link className={`${styles.propertyRow} ${attention ? styles.propertyAttention : ""}`} href={`/properties/${property.id}`} key={property.id}>
                <span className={styles.monogram}>{property.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span>
                <span className={styles.propertyCopy}>
                  <span className={styles.propertyTitle}>
                    <strong>{property.name}</strong>
                    {property.status !== "active" && <em>{property.status === "sold_closed" ? "closed" : property.status}</em>}
                  </span>
                  <span className={styles.location}><MapPin size={12} />{property.address}</span>
                  <span className={styles.workload}>
                    {overdue > 0 ? <span className={styles.attentionText}><AlertCircle size={11} />{overdue} overdue</span> : <span>{open.length} open {open.length === 1 ? "task" : "tasks"}</span>}
                    {overdue > 0 && <span>{open.length} open</span>}
                    {deadline && <span>Next {deadline}</span>}
                  </span>
                </span>
                <ChevronRight className={styles.rowChevron} size={18} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyList}>
          <strong>{query || filter !== "all" ? "No matching properties" : "No properties yet"}</strong>
          <p>{query || filter !== "all" ? "Try another search or filter." : "Add a property to begin organizing its operational work."}</p>
          {!query && filter === "all" && <button type="button" onClick={() => setCreating(true)}><Plus size={16} /> Add property</button>}
        </div>
      )}

      {creating && <PropertyCreate onClose={() => setCreating(false)} onCreate={createProperty} />}
    </div>
  );
}

function PropertySkeleton() {
  return <div className={styles.propertyGroup} aria-label="Loading properties">{[1, 2, 3].map((item) => <div className={styles.propertySkeleton} key={item} />)}</div>;
}

function PropertyCreate({ onClose, onCreate }: { onClose: () => void; onCreate: ReturnType<typeof useApp>["createProperty"] }) {
  const [form, setForm] = useState({ name: "", address: "", description: "", status: "new" as PropertyStatus });
  const [saving, setSaving] = useState(false);
  return <div className="sheet-backdrop"><section className="sheet" role="dialog" aria-modal="true" aria-label="Add property"><div className="sheet-handle"/><div className="sheet-heading"><div><span className="eyebrow">NEW PROPERTY</span><h2>Add to portfolio</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close"><X size={20}/></button></div><form className="detail-form" onSubmit={async (event) => { event.preventDefault(); setSaving(true); await onCreate(form); setSaving(false); onClose(); }}><label>Property name<input autoFocus required value={form.name} onChange={(event) => setForm({...form,name:event.target.value})} placeholder="e.g. Floreasca Residence"/></label><label>Address<input required value={form.address} onChange={(event) => setForm({...form,address:event.target.value})} placeholder="Street and city"/></label><label>Description<textarea rows={3} value={form.description} onChange={(event) => setForm({...form,description:event.target.value})}/></label><label>Status<select value={form.status} onChange={(event) => setForm({...form,status:event.target.value as PropertyStatus})}><option value="new">New</option><option value="active">Active</option><option value="paused">Paused</option><option value="sold_closed">Sold / Closed</option><option value="archived">Archived</option></select></label><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Add property"}</button></form></section></div>;
}
