"use client";

import { Clock3, MapPin, Repeat2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { friendlyDate } from "@/lib/date";
import type { Task } from "@/types";

export function TaskCard({ task, showDate = false }: { task: Task; showDate?: boolean }) {
  const { properties, toggleTask } = useApp();
  const [open, setOpen] = useState(false);
  const property = properties.find((item) => item.id === task.propertyId);
  return <>
    <article className={`task-card priority-${task.priority} ${task.status === "completed" ? "is-complete" : ""}`}>
      <button className="task-check" onClick={() => void toggleTask(task.id)} aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`}><span /></button>
      <button className="task-body" onClick={() => setOpen(true)}>
        <strong>{task.title}</strong>
        <span className="task-meta">
          {property && <span><MapPin size={13} />{property.name}</span>}
          {(showDate || task.dueTime) && <span><Clock3 size={13} />{showDate ? friendlyDate(task.dueDate) : task.dueTime}</span>}
          {task.recurrence && <span><Repeat2 size={13} />{task.recurrence.frequency}</span>}
        </span>
      </button>
      <span className={`category-dot category-${task.category}`} title={task.category} />
    </article>
    {open && <TaskDetailSheet task={task} open onClose={() => setOpen(false)} />}
  </>;
}
