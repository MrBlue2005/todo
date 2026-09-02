"use client";

import { format } from "date-fns";
import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { TodayTaskItem } from "@/components/today-task-item";
import { taskBucket } from "@/lib/date";
import type { Priority, Task } from "@/types";
import styles from "./today.module.css";

const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const dueTimeValue = (task: Task) => task.dueTime ?? "24:00";

function sortAttentionTasks(a: Task, b: Task) {
  return priorityOrder[a.priority] - priorityOrder[b.priority]
    || a.dueDate.localeCompare(b.dueDate)
    || dueTimeValue(a).localeCompare(dueTimeValue(b))
    || a.title.localeCompare(b.title);
}

function sortUpcomingTasks(a: Task, b: Task) {
  return a.dueDate.localeCompare(b.dueDate)
    || priorityOrder[a.priority] - priorityOrder[b.priority]
    || dueTimeValue(a).localeCompare(dueTimeValue(b))
    || a.title.localeCompare(b.title);
}

export default function TodayPage() {
  const { tasks, ready, isDemo, profile } = useApp();
  const [completedOpen, setCompletedOpen] = useState(false);
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = profile?.displayName || (isDemo ? "Richard" : "");

  const buckets = useMemo(() => {
    const overdue = tasks.filter((task) => taskBucket(task) === "overdue").sort(sortAttentionTasks);
    const today = tasks.filter((task) => taskBucket(task) === "today").sort(sortAttentionTasks);
    const upcoming = tasks.filter((task) => taskBucket(task) === "upcoming").sort(sortUpcomingTasks);
    const completed = tasks
      .filter((task) => taskBucket(task) === "completed")
      .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
    return { overdue, today, upcoming, completed };
  }, [tasks]);

  const hasAttentionItems = buckets.overdue.length > 0 || buckets.today.length > 0;

  return (
    <div className={`screen ${styles.screen}`}>
      <header className={styles.header}>
        <h1>{greeting}{displayName ? `, ${displayName}` : ""}</h1>
        <p>{format(now, "EEEE, MMMM d")}</p>
      </header>

      <div className={styles.summary} aria-label="Workload summary">
        <span><strong>{buckets.today.length}</strong> today</span>
        <i aria-hidden="true" />
        <span className={buckets.overdue.length ? styles.overdueSummary : undefined}><strong>{buckets.overdue.length}</strong> overdue</span>
        <i aria-hidden="true" />
        <span><strong>{buckets.upcoming.length}</strong> upcoming</span>
      </div>

      {!ready ? <TaskSkeleton /> : (
        <div className={styles.sections}>
          <TaskSection title="Overdue" tasks={buckets.overdue} urgent />

          <TaskSection
            title="Today"
            tasks={buckets.today}
            empty={
              <div className={styles.allClear}>
                <span><Sparkles size={16} strokeWidth={1.7} /></span>
                <div>
                  <strong>{hasAttentionItems ? "Today is clear" : "Nothing needs your attention"}</strong>
                  <p>{hasAttentionItems ? "Only the overdue items above remain." : "You’re all caught up for now."}</p>
                </div>
              </div>
            }
          />

          <TaskSection
            title="Upcoming"
            tasks={buckets.upcoming.slice(0, 4)}
            count={buckets.upcoming.length}
            action={buckets.upcoming.length > 4 ? (
              <Link href="/calendar" className={styles.viewAll}>View all <ArrowRight size={14} /></Link>
            ) : undefined}
          />

          {buckets.completed.length > 0 && (
            <section className={styles.completedSection}>
              <button
                className={styles.completedToggle}
                type="button"
                onClick={() => setCompletedOpen((open) => !open)}
                aria-expanded={completedOpen}
              >
                <span className={styles.completedLabel}><Check size={15} /> Completed <em>{buckets.completed.length}</em></span>
                <ChevronDown size={17} className={completedOpen ? styles.rotated : undefined} />
              </button>
              {completedOpen && (
                <div className={`${styles.taskGroup} ${styles.completedGroup}`}>
                  {buckets.completed.map((task) => <TodayTaskItem key={task.id} task={task} />)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TaskSection({ title, tasks, count, urgent = false, empty, action }: { title: string; tasks: Task[]; count?: number; urgent?: boolean; empty?: React.ReactNode; action?: React.ReactNode }) {
  if (!tasks.length && !empty) return null;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div className={urgent ? styles.urgentHeading : undefined}>
          <h2>{title}</h2>
          <span>{count ?? tasks.length}</span>
        </div>
        {action}
      </div>
      {tasks.length ? <div className={styles.taskGroup}>{tasks.map((task) => <TodayTaskItem key={task.id} task={task} />)}</div> : empty}
    </section>
  );
}

function TaskSkeleton() {
  return (
    <div className={styles.skeletons} aria-label="Loading tasks">
      <div className={styles.skeletonTitle} />
      {[1, 2, 3].map((item) => <div className={styles.skeletonRow} key={item} />)}
    </div>
  );
}
