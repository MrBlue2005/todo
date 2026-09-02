"use client";

import { format, parseISO } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, ChevronDown, ChevronRight, Flag, MapPin, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { QuickCreateSheet } from "@/components/quick-create-sheet";
import { MobileSheet } from "@/components/task-interactions/mobile-sheet";
import { TodayTaskItem } from "@/components/today-task-item";
import { localDate, taskBucket } from "@/lib/date";
import type { Campaign, Property, PropertyStatus, Task } from "@/types";
import styles from "../properties.module.css";

const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const sortAttention = (a: Task, b: Task) => priorityRank[a.priority] - priorityRank[b.priority] || a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00");
const sortUpcoming = (a: Task, b: Task) => a.dueDate.localeCompare(b.dueDate) || priorityRank[a.priority] - priorityRank[b.priority] || (a.dueTime ?? "24:00").localeCompare(b.dueTime ?? "24:00");

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { properties, tasks, campaigns, ready, launchCampaign, deleteProperty, updateProperty } = useApp();
  const [creating, setCreating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const property = properties.find((item) => item.id === id);

  if (!ready) return <div className={`screen ${styles.detailScreen}`}><div className={styles.detailSkeleton} /></div>;
  if (!property) return <div className={`screen ${styles.notFound}`}><h1>Property not found</h1><button type="button" onClick={() => router.push("/properties")}>Back to properties</button></div>;

  const propertyTasks = tasks.filter((task) => task.propertyId === id);
  const active = propertyTasks.filter((task) => task.status === "todo");
  const completed = propertyTasks.filter((task) => task.status === "completed").sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  const overdue = active.filter((task) => taskBucket(task) === "overdue").sort(sortAttention);
  const today = active.filter((task) => taskBucket(task) === "today").sort(sortAttention);
  const upcoming = active.filter((task) => taskBucket(task) === "upcoming").sort(sortUpcoming);
  const orderedActive = [...overdue, ...today, ...upcoming];
  const propertyCampaigns = campaigns.filter((campaign) => campaign.propertyId === id);
  const simpleTaskList = active.length <= 2;

  async function handleDelete() {
    if (!property || !confirm(`Delete ${property.name}? Its tasks will be detached.`)) return;
    await deleteProperty(property.id);
    router.push("/properties");
  }

  return (
    <div className={`screen ${styles.detailScreen}`}>
      <div className={styles.detailTopbar}>
        <button className={styles.back} type="button" onClick={() => router.back()}><ArrowLeft size={19} /> Properties</button>
        <button className={styles.editButton} type="button" onClick={() => setEditing(true)} aria-label="Edit property"><Pencil size={16} /></button>
      </div>

      <header className={styles.detailHeader}>
        <span className={styles.detailStatus}>{property.status.replace("_", " / ")}</span>
        <h1>{property.name}</h1>
        <p><MapPin size={14} />{property.address}</p>
        <div className={styles.detailSummary} aria-label="Property workload summary">
          <span><strong>{today.length}</strong> today</span><i />
          <span className={overdue.length ? styles.summaryUrgent : undefined}><strong>{overdue.length}</strong> overdue</span><i />
          <span><strong>{upcoming.length}</strong> upcoming</span>
        </div>
      </header>

      <div className={styles.primaryActions}>
        <button className={styles.addTask} type="button" onClick={() => setCreating(true)}><Plus size={18} /> Add task</button>
        <button className={styles.campaignAction} type="button" onClick={() => setLaunching(true)}>
          <span><Rocket size={18} /></span>
          <span><small>Campaign</small><strong>Launch property campaign</strong></span>
          <ChevronRight size={17} />
        </button>
      </div>

      <div className={styles.detailSections}>
        <section>
          <SectionHeading title={simpleTaskList ? "Open work" : "Property tasks"} count={active.length} />
          {active.length === 0 ? (
            <div className={styles.noWork}><Check size={18} /><div><strong>No pending work</strong><p>Create a task or launch a campaign for this property.</p></div></div>
          ) : simpleTaskList ? (
            <TaskGroup tasks={orderedActive} />
          ) : (
            <div className={styles.taskSections}>
              <TaskSection title="Needs attention" tasks={overdue} urgent />
              <TaskSection title="Today" tasks={today} />
              <TaskSection title="Upcoming" tasks={upcoming} />
            </div>
          )}
        </section>

        {propertyCampaigns.length > 0 && (
          <section>
            <SectionHeading title="Campaigns" count={propertyCampaigns.length} />
            <div className={styles.campaignGroup}>{propertyCampaigns.map((campaign) => <CampaignRow campaign={campaign} tasks={active} key={campaign.id} />)}</div>
          </section>
        )}

        {completed.length > 0 && (
          <section>
            <button className={styles.completedToggle} type="button" onClick={() => setCompletedOpen((open) => !open)} aria-expanded={completedOpen}>
              <span><Check size={15} /> Completed <em>{completed.length}</em></span>
              <ChevronDown size={17} className={completedOpen ? styles.rotated : undefined} />
            </button>
            {completedOpen && <TaskGroup tasks={completed} completed />}
          </section>
        )}

        <section className={styles.detailsSection}>
          <SectionHeading title="Property details" />
          <div className={styles.detailsCard}>
            <div><small>Status</small><strong>{property.status.replace("_", " / ")}</strong></div>
            {property.description && <p>{property.description}</p>}
            <button type="button" onClick={() => setEditing(true)}><Pencil size={14} /> Edit property details</button>
          </div>
        </section>
      </div>

      {creating && <QuickCreateSheet open onClose={() => setCreating(false)} propertyId={id} />}
      {launching && <CampaignLaunch property={property} onClose={() => setLaunching(false)} onLaunch={launchCampaign} />}
      {editing && <PropertyEdit property={property} onClose={() => setEditing(false)} onSave={updateProperty} onDelete={handleDelete} />}
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return <div className={styles.sectionHeading}><h2>{title}</h2>{count !== undefined && <span>{count}</span>}</div>;
}

function TaskGroup({ tasks, completed = false }: { tasks: Task[]; completed?: boolean }) {
  return <div className={`${styles.taskGroup} ${completed ? styles.completedGroup : ""}`}>{tasks.map((task) => <TodayTaskItem key={task.id} task={task} showProperty={false} showCategory />)}</div>;
}

function TaskSection({ title, tasks, urgent = false }: { title: string; tasks: Task[]; urgent?: boolean }) {
  if (!tasks.length) return null;
  return <section><div className={`${styles.taskSubheading} ${urgent ? styles.taskSubheadingUrgent : ""}`}><h3>{title}</h3><span>{tasks.length}</span></div><TaskGroup tasks={tasks} /></section>;
}

function CampaignRow({ campaign, tasks }: { campaign: Campaign; tasks: Task[] }) {
  const next = tasks.filter((task) => task.campaignId === campaign.id).sort(sortUpcoming)[0];
  const nextLabel = next ? `${taskBucket(next) === "today" ? "Today" : format(parseISO(next.dueDate), "MMM d")}${next.dueTime ? ` · ${next.dueTime}` : ""}` : "No pending tasks";
  return <div className={styles.campaignRow}><span className={styles.campaignIcon}><Flag size={17} /></span><span><small>{campaign.status} · Started {format(parseISO(campaign.startDate), "MMM d")}</small><strong>{campaign.name}</strong><em>Next: {nextLabel}</em></span></div>;
}

function CampaignLaunch({ property, onClose, onLaunch }: { property: Property; onClose: () => void; onLaunch: ReturnType<typeof useApp>["launchCampaign"] }) {
  const [submitting, setSubmitting] = useState(false);
  const schedule = [
    ["Today", "Prepare photographs · Write description"],
    ["Tomorrow", "Publish listings · Prepare and launch social"],
    ["Day 4", "Check campaign performance"],
    ["Day 8", "Review results and adjust"],
  ];
  return <MobileSheet open onClose={onClose} title="New Property Campaign" eyebrow="CAMPAIGN TEMPLATE"><p className={styles.campaignIntro}>Create 8 coordinated launch tasks for {property.name} across the first seven days.</p><div className={styles.schedule}>{schedule.map(([day, work]) => <div key={day}><strong>{day}</strong><span>{work}</span></div>)}</div><form className={styles.campaignForm} onSubmit={async (event) => { event.preventDefault(); if (submitting) return; setSubmitting(true); await onLaunch(property.id, new FormData(event.currentTarget).get("startDate") as string); onClose(); }}><label><CalendarDays size={17} /><span>Campaign start</span><input name="startDate" type="date" defaultValue={localDate()} required /></label><button type="submit" disabled={submitting}><Flag size={17} />{submitting ? "Creating…" : "Create campaign"}</button></form></MobileSheet>;
}

function PropertyEdit({ property, onClose, onSave, onDelete }: { property: Property; onClose: () => void; onSave: ReturnType<typeof useApp>["updateProperty"]; onDelete: () => Promise<void> }) {
  const [draft, setDraft] = useState(property);
  return <MobileSheet open full title="Edit property" eyebrow="PROPERTY DETAILS" onClose={onClose}><form className={`detail-form ${styles.editForm}`} onSubmit={async (event) => { event.preventDefault(); if (await onSave(property.id, draft)) onClose(); }}><label>Name<input value={draft.name} onChange={(event) => setDraft({...draft,name:event.target.value})} required/></label><label>Address<input value={draft.address} onChange={(event) => setDraft({...draft,address:event.target.value})} required/></label><label>Description<textarea rows={3} value={draft.description} onChange={(event) => setDraft({...draft,description:event.target.value})}/></label><label>Status<select value={draft.status} onChange={(event) => setDraft({...draft,status:event.target.value as PropertyStatus})}><option value="new">New</option><option value="active">Active</option><option value="paused">Paused</option><option value="sold_closed">Sold / Closed</option><option value="archived">Archived</option></select></label><button className="primary-button" type="submit">Save changes</button><button className={styles.deleteInsideEdit} type="button" onClick={() => void onDelete()}><Trash2 size={16} /> Delete property</button></form></MobileSheet>;
}
