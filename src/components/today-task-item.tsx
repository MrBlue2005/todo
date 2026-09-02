"use client";

import { format, isTomorrow, parseISO } from "date-fns";
import { Check, Clock3, MapPin, Repeat2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { taskBucket } from "@/lib/date";
import type { Task } from "@/types";
import styles from "@/app/today/today.module.css";

function deadlineLabel(task: Task) {
  const bucket = taskBucket(task);
  const time = task.dueTime;
  if (bucket === "overdue") return time ? `Overdue · ${time}` : "Overdue";
  if (bucket === "today") return time ? `Today · ${time}` : "Today";
  const due = parseISO(task.dueDate);
  const date = isTomorrow(due) ? "Tomorrow" : format(due, "MMM d");
  return time ? `${date} · ${time}` : date;
}

export function TodayTaskItem({ task, showProperty = true, showCategory = false }: { task: Task; showProperty?: boolean; showCategory?: boolean }) {
  const { properties, toggleTask } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const property = properties.find((item) => item.id === task.propertyId);
  const completed = task.status === "completed";
  const emphasizedPriority = task.priority === "urgent" || task.priority === "high";

  async function handleToggle() {
    if (completing) return;
    setCompleting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    await toggleTask(task.id);
    setCompleting(false);
  }

  return (
    <>
      <article className={`${styles.taskItem} ${completed ? styles.isCompleted : ""} ${completing ? styles.isCompleting : ""}`}>
        <button className={styles.checkButton} type="button" onClick={() => void handleToggle()} aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>
          <span className={`${styles.checkCircle} ${task.priority === "urgent" ? styles.urgentCheck : task.priority === "high" ? styles.highCheck : ""}`}>
            {(completed || completing) && <Check size={14} strokeWidth={2.5} />}
          </span>
        </button>
        <button className={styles.taskBody} type="button" onClick={() => setDetailOpen(true)}>
          <strong>{task.title}</strong>
          <span className={styles.primaryMeta}>
            {showProperty && property && <span><MapPin size={12} />{property.name}</span>}
            <span className={taskBucket(task) === "overdue" ? styles.overdueMeta : undefined}><Clock3 size={12} />{deadlineLabel(task)}</span>
          </span>
          {(emphasizedPriority || task.recurrence || (showCategory && task.category === "report")) && (
            <span className={styles.signals}>
              {emphasizedPriority && <em className={task.priority === "urgent" ? styles.urgentSignal : styles.highSignal}>{task.priority}</em>}
              {showCategory && task.category === "report" && <em>{task.category}</em>}
              {task.recurrence && <em><Repeat2 size={10} />{task.recurrence.frequency}</em>}
            </span>
          )}
        </button>
      </article>
      {detailOpen && <TaskDetailSheet task={task} open onClose={() => setDetailOpen(false)} />}
    </>
  );
}
