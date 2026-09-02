"use client";

import { format } from "date-fns";
import { ArrowRight, Check, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { TodayTaskItem } from "@/components/today-task-item";
import { taskBucket } from "@/lib/date";
import type { Priority, Task } from "@/types";
import styles from "./today.module.css";

const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const dueTimeValue = (task: Task) => task.dueTime ?? "24:00";
type AmbientPeriod = "morning" | "day" | "evening" | "night";

function ambientPeriodForHour(hour: number): AmbientPeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function useLocalAmbientPeriod() {
  const [period, setPeriod] = useState<AmbientPeriod>("day");

  useEffect(() => {
    let timer = 0;

    function updatePeriod() {
      window.clearTimeout(timer);
      const localNow = new Date();
      setPeriod(ambientPeriodForHour(localNow.getHours()));

      const nextBoundary = new Date(localNow);
      const nextHour = [6, 11, 17, 22].find((hour) => hour > localNow.getHours());
      if (nextHour === undefined) nextBoundary.setDate(nextBoundary.getDate() + 1);
      nextBoundary.setHours(nextHour ?? 6, 0, 1, 0);
      timer = window.setTimeout(updatePeriod, nextBoundary.getTime() - localNow.getTime());
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") updatePeriod();
    }

    updatePeriod();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  return period;
}

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
  const [departingTasks, setDepartingTasks] = useState<Task[]>([]);
  const departureTimers = useRef(new Set<number>());
  const ambientPeriod = useLocalAmbientPeriod();
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
  const tasksWithDepartures = useCallback((visibleTasks: Task[], bucket: "overdue" | "today" | "upcoming") => [
    ...visibleTasks,
    ...departingTasks.filter((task) => taskBucket(task) === bucket && !visibleTasks.some((visible) => visible.id === task.id)),
  ], [departingTasks]);

  const beginTaskCompletion = useCallback((task: Task) => {
    if (task.status === "completed") return;
    setDepartingTasks((current) => current.some((item) => item.id === task.id) ? current : [...current, task]);
    const timer = window.setTimeout(() => {
      setDepartingTasks((current) => current.filter((item) => item.id !== task.id));
      departureTimers.current.delete(timer);
    }, 380);
    departureTimers.current.add(timer);
  }, []);

  useEffect(() => () => {
    departureTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <div className={`screen ${styles.screen}`} data-ambient={ambientPeriod}>
      <header className={styles.header}>
        <h1>{greeting}{displayName ? `, ${displayName}` : ""}</h1>
        <p>{format(now, "EEEE, MMMM d")}</p>
      </header>

      <div className={styles.summary} aria-label="Workload summary">
        <span className={buckets.today.length ? styles.todaySummary : undefined}><strong>{buckets.today.length}</strong> today</span>
        <i aria-hidden="true" />
        <span className={buckets.overdue.length ? styles.overdueSummary : undefined}><strong>{buckets.overdue.length}</strong> overdue</span>
        <i aria-hidden="true" />
        <span className={buckets.upcoming.length ? styles.upcomingSummary : undefined}><strong>{buckets.upcoming.length}</strong> upcoming</span>
      </div>

      {!ready ? <TaskSkeleton /> : (
        <div className={styles.sections}>
          <TaskSection title="Overdue" tasks={tasksWithDepartures(buckets.overdue, "overdue")} urgent onCompletionStart={beginTaskCompletion} />

          <TaskSection
            title="Today"
            tasks={tasksWithDepartures(buckets.today, "today")}
            onCompletionStart={beginTaskCompletion}
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
            tasks={tasksWithDepartures(buckets.upcoming, "upcoming").slice(0, 4)}
            count={buckets.upcoming.length}
            onCompletionStart={beginTaskCompletion}
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

function TaskSection({ title, tasks, count, urgent = false, empty, action, onCompletionStart }: { title: string; tasks: Task[]; count?: number; urgent?: boolean; empty?: React.ReactNode; action?: React.ReactNode; onCompletionStart?: (task: Task) => void }) {
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
      {tasks.length ? <div className={styles.taskGroup}>{tasks.map((task) => <TodayTaskItem key={task.id} task={task} onCompletionStart={onCompletionStart} />)}</div> : empty}
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
