"use client";

import {
  addDays, addMonths, addWeeks, eachDayOfInterval, format, isBefore, isSameDay,
  isToday, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/app-provider";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { MobileSheet } from "@/components/task-interactions/mobile-sheet";
import { localDate, taskBucket } from "@/lib/date";
import type { Task } from "@/types";
import styles from "./calendar.module.css";

const CALENDAR_DATE_EVENT = "rx-calendar-date-change";

type AmbientPeriod = "morning" | "day" | "evening" | "night";

function ambientPeriodForHour(hour: number): AmbientPeriod {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function useAmbientPeriod() {
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

function sortTasks(a: Task, b: Task) {
  if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime) || a.title.localeCompare(b.title);
  if (a.dueTime) return -1;
  if (b.dueTime) return 1;
  return a.title.localeCompare(b.title);
}

function dayHeading(date: Date) {
  if (isToday(date)) return "Today";
  if (isSameDay(date, addDays(new Date(), 1))) return "Tomorrow";
  return format(date, "EEEE");
}

function AgendaTask({ task }: { task: Task }) {
  const { properties, toggleTask } = useApp();
  const [detailOpen, setDetailOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const property = properties.find((item) => item.id === task.propertyId);
  const emphasized = task.priority === "urgent" || task.priority === "high";
  const bucket = taskBucket(task);
  const completed = task.status === "completed";
  const overdue = bucket === "overdue";
  const dueToday = bucket === "today";

  async function complete() {
    if (completing) return;
    setCompleting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    await toggleTask(task.id);
  }

  return (
    <>
      <article className={`${styles.taskRow} ${completed ? styles.taskRowCompleted : ""} ${completing ? styles.completing : ""}`}>
        <time className={`${styles.taskTime} ${overdue ? styles.timeOverdue : ""} ${dueToday ? styles.timeToday : ""}`} dateTime={task.dueTime ?? undefined}>{task.dueTime ?? "Any time"}</time>
        <button type="button" className={styles.completeButton} onClick={() => void complete()} aria-label={`Complete ${task.title}`}>
          <span className={task.priority === "urgent" ? styles.urgentCheck : task.priority === "high" ? styles.highCheck : ""}>
            {completing && <Check size={13} strokeWidth={2.6} />}
          </span>
        </button>
        <button type="button" className={styles.taskBody} onClick={() => setDetailOpen(true)}>
          <strong>{task.title}</strong>
          <span className={styles.taskContext}>
            {property && <span><MapPin size={11} />{property.name}</span>}
            {emphasized && <em className={task.priority === "urgent" ? styles.urgent : styles.high}>{task.priority}</em>}
            {(task.category === "report" || task.category === "campaign") && <em>{task.category}</em>}
          </span>
        </button>
      </article>
      {detailOpen && <TaskDetailSheet task={task} open onClose={() => setDetailOpen(false)} />}
    </>
  );
}

function DatePicker({ selected, tasks, onSelect, onClose }: { selected: Date; tasks: Task[]; onSelect: (date: Date) => void; onClose: () => void }) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(selected));
  const gridStart = startOfWeek(visibleMonth, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: addDays(gridStart, 41) });
  const taskDates = new Set(tasks.filter((task) => task.status === "todo").map((task) => task.dueDate));

  return (
    <MobileSheet open onClose={onClose} title="Choose a date" eyebrow="CALENDAR">
      <div className={styles.pickerNav}>
        <button type="button" onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))} aria-label="Previous month"><ChevronLeft size={19} /></button>
        <strong>{format(visibleMonth, "MMMM yyyy")}</strong>
        <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} aria-label="Next month"><ChevronRight size={19} /></button>
      </div>
      <div className={styles.pickerWeekdays} aria-hidden="true">{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
      <div className={styles.monthGrid}>
        {days.map((day) => {
          const outside = day.getMonth() !== visibleMonth.getMonth();
          const active = isSameDay(day, selected);
          return (
            <button type="button" key={localDate(day)} className={`${active ? styles.selectedDay : ""} ${isToday(day) ? styles.todayDay : ""} ${outside ? styles.outsideDay : ""}`} onClick={() => { onSelect(day); onClose(); }} aria-label={format(day, "EEEE, MMMM d, yyyy")} aria-pressed={active}>
              <span>{format(day, "d")}</span>{taskDates.has(localDate(day)) && <i />}
            </button>
          );
        })}
      </div>
      <button type="button" className={styles.pickerToday} onClick={() => { onSelect(new Date()); onClose(); }}>Go to today</button>
    </MobileSheet>
  );
}
export default function CalendarPage() {
  const { tasks, ready } = useApp();
  const ambientPeriod = useAmbientPeriod();
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const weekStart = startOfWeek(selected, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const today = startOfDay(new Date());
  const activeTasks = useMemo(() => tasks.filter((task) => task.status === "todo"), [tasks]);
  const overdueCount = activeTasks.filter((task) => isBefore(parseISO(task.dueDate), today)).length;
  const agendaGroups = useMemo(() => {
    const start = localDate(selected);
    const grouped = new Map<string, Task[]>();
    activeTasks.filter((task) => task.dueDate >= start).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || sortTasks(a, b)).forEach((task) => grouped.set(task.dueDate, [...(grouped.get(task.dueDate) ?? []), task]));
    return Array.from(grouped.entries()).slice(0, 12);
  }, [activeTasks, selected]);
  const selectedHasTasks = agendaGroups[0]?.[0] === localDate(selected);

  useEffect(() => { window.dispatchEvent(new CustomEvent(CALENDAR_DATE_EVENT, { detail: localDate(selected) })); }, [selected]);

  function chooseDate(date: Date) {
    setSelected(startOfDay(date));
    document.querySelector(".app-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={styles.screen} data-ambient={ambientPeriod}>
      <header className={styles.header}>
        <button type="button" className={styles.monthButton} onClick={() => setPickerOpen(true)} aria-label={`Choose date, currently ${format(selected, "MMMM yyyy")}`}><span>Schedule</span><strong>{format(selected, "MMMM yyyy")}</strong></button>
        {!isSameDay(selected, today) && <button type="button" className={styles.todayButton} onClick={() => chooseDate(today)}>Today</button>}
      </header>

      <section className={styles.dateNavigator} aria-label="Date navigation">
        <div className={styles.weekControls}>
          <button type="button" onClick={() => chooseDate(subWeeks(selected, 1))} aria-label="Previous week"><ChevronLeft size={18} /></button>
          <span>{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}</span>
          <button type="button" onClick={() => chooseDate(addWeeks(selected, 1))} aria-label="Next week"><ChevronRight size={18} /></button>
        </div>
        <div className={styles.weekStrip}>
          {days.map((day) => {
            const active = isSameDay(day, selected);
            const hasTasks = activeTasks.some((task) => task.dueDate === localDate(day));
            return <button type="button" key={localDate(day)} className={`${active ? styles.selected : ""} ${isToday(day) ? styles.today : ""}`} onClick={() => chooseDate(day)} aria-label={format(day, "EEEE, MMMM d")} aria-pressed={active}><small>{format(day, "EEEEE")}</small><strong>{format(day, "d")}</strong>{hasTasks && <i />}</button>;
          })}
        </div>
      </section>

      <section className={styles.agenda} aria-label="Agenda">
        <div className={styles.agendaIntro}>
          <div><span>{isSameDay(selected, today) ? "Your agenda" : "From selected date"}</span><h1>{format(selected, "EEEE, MMMM d")}</h1></div>
          <span>{agendaGroups.reduce((sum, [, group]) => sum + group.length, 0)} scheduled</span>
        </div>
        {overdueCount > 0 && !isBefore(today, selected) && <Link href="/today" className={styles.overdueNotice}><span>{overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"}</span><small>Review in Today</small><ChevronRight size={15} /></Link>}
        {!ready ? <div className={styles.skeletons}>{[1, 2, 3].map((item) => <div key={item} />)}</div> : agendaGroups.length > 0 ? (
          <div className={styles.dayGroups}>
            {!selectedHasTasks && <div className={styles.openDay}><CalendarDays size={18} /><div><strong>No tasks on {format(selected, "MMMM d")}</strong><span>Next scheduled work continues below.</span></div></div>}
            {agendaGroups.map(([date, group], index) => {
              const day = parseISO(date);
              return <section className={styles.dayGroup} key={date}><header className={styles.dayHeader}><div><h2>{dayHeading(day)}</h2><span>· {format(day, "MMM d")}</span></div>{index === 0 && !selectedHasTasks && <small>Next</small>}<em>{group.length}</em></header><div className={styles.taskList}>{group.sort(sortTasks).map((task) => <AgendaTask key={task.id} task={task} />)}</div></section>;
            })}
          </div>
        ) : <div className={styles.emptyCalendar}><CalendarDays size={22} /><strong>Nothing scheduled yet</strong><p>Tasks with due dates will appear here.</p></div>}
      </section>
      {pickerOpen && <DatePicker selected={selected} tasks={tasks} onSelect={chooseDate} onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
