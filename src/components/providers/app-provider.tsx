"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import type { Campaign, Property, PropertyStatus, Task, TaskDraft } from "@/types";
import { demoCampaigns, demoProperties, demoTasks } from "@/lib/demo-data";
import { localDate, nextOccurrence } from "@/lib/date";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

const STORAGE_KEY = "rx-tasks-demo-v1";

interface AppData {
  tasks: Task[];
  properties: Property[];
  campaigns: Campaign[];
}

const EMPTY_DATA: AppData = { tasks: [], properties: [], campaigns: [] };

interface ProfileIdentity {
  displayName: string;
  email: string;
  avatarPath: string | null;
  avatarUrl: string | null;
}

interface AppContextValue extends AppData {
  ready: boolean;
  isDemo: boolean;
  profile: ProfileIdentity | null;
  notice: string | null;
  clearNotice: () => void;
  createTask: (draft: TaskDraft) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
  deleteTask: (id: string) => Promise<void>;
  toggleTask: (id: string) => Promise<void>;
  setTaskReminder: (id: string, offsetMinutes: number | null, schedule?: Pick<Task, "dueDate" | "dueTime">) => Promise<boolean>;
  createProperty: (input: { name: string; address: string; description?: string; status?: PropertyStatus }) => Promise<Property>;
  updateProperty: (id: string, patch: Partial<Property>) => Promise<boolean>;
  deleteProperty: (id: string) => Promise<void>;
  launchCampaign: (propertyId: string, startDate: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<void>;
  removeProfilePhoto: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const randomId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const emailPrefix = (email: string) => email.split("@")[0]?.trim() || "RX user";
const AVATAR_INPUT_LIMIT = 10 * 1024 * 1024;
const AVATAR_STORAGE_LIMIT = 2 * 1024 * 1024;
const AVATAR_SIZE = 512;
const avatarTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const avatarExtensions = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const logMutationError = (operation: string, error: { code?: string; message: string; details?: string; hint?: string }) => {
  console.error(`[Supabase mutation: ${operation}] ${JSON.stringify({
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })}`);
};

function acceptsAvatar(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return avatarTypes.has(file.type.toLowerCase()) || Boolean(extension && avatarExtensions.has(extension));
}

async function prepareAvatar(file: File) {
  if (!acceptsAvatar(file)) throw new Error("avatar-type");
  if (file.size > AVATAR_INPUT_LIMIT) throw new Error("avatar-size");

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = sourceUrl;
    try { await image.decode(); } catch { throw new Error("avatar-decode"); }
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error("avatar-decode");
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("avatar-decode");
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    if (!blob || blob.size > AVATAR_STORAGE_LIMIT) throw new Error("avatar-process");
    return blob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function readDemo(): AppData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AppData;
  } catch {}
  return { tasks: demoTasks, properties: demoProperties, campaigns: demoCampaigns };
}

const fromTaskRow = (row: Record<string, unknown>): Task => ({
  id: String(row.id), userId: String(row.user_id), propertyId: row.property_id ? String(row.property_id) : null,
  campaignId: row.campaign_id ? String(row.campaign_id) : null, title: String(row.title),
  description: String(row.description ?? ""), category: row.category as Task["category"], priority: row.priority as Task["priority"],
  status: row.status as Task["status"], dueDate: String(row.due_date), dueTime: row.due_time ? String(row.due_time).slice(0, 5) : null,
  recurrence: row.recurrence_rule as Task["recurrence"], reminders: Array.isArray(row.task_reminders) ? row.task_reminders.map((reminder: Record<string, unknown>) => ({ id: String(reminder.id), taskId: String(reminder.task_id), remindAt: String(reminder.remind_at), offsetMinutes: reminder.offset_minutes === null ? null : Number(reminder.offset_minutes), sentAt: reminder.sent_at ? String(reminder.sent_at) : null })) : [], completedAt: row.completed_at ? String(row.completed_at) : null,
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const taskRow = (task: Task) => ({
  id: task.id, user_id: task.userId, property_id: task.propertyId, campaign_id: task.campaignId, title: task.title,
  description: task.description, category: task.category, priority: task.priority, status: task.status,
  due_date: task.dueDate, due_time: task.dueTime, recurrence_rule: task.recurrence, completed_at: task.completedAt,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [isDemo, setIsDemo] = useState(!isSupabaseConfigured);
  const [profile, setProfile] = useState<ProfileIdentity | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (supabase) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (auth.user) {
          const [taskResult, propertyResult, campaignResult, profileResult] = await Promise.all([
            supabase.from("tasks").select("*,task_reminders(*)").order("due_date"),
            supabase.from("properties").select("*").order("name"),
            supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
            supabase.from("profiles").select("display_name,avatar_path").eq("id", auth.user.id).maybeSingle(),
          ]);
          if (!taskResult.error && !propertyResult.error && !campaignResult.error && !cancelled) {
            const email = auth.user.email ?? "";
            const storedDisplayName = profileResult.data?.display_name?.trim();
            const avatarPath = profileResult.data?.avatar_path?.trim() || null;
            let avatarUrl: string | null = null;
            if (avatarPath) {
              const signed = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
              if (signed.error) logMutationError("avatars.createSignedUrl", signed.error);
              else avatarUrl = signed.data.signedUrl;
            }
            setData({
              tasks: taskResult.data.map((row) => fromTaskRow(row)),
              properties: propertyResult.data.map((row) => ({ id: row.id, userId: row.user_id, name: row.name, address: row.address, description: row.description ?? "", status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })),
              campaigns: campaignResult.data.map((row) => ({ id: row.id, userId: row.user_id, propertyId: row.property_id, templateId: row.template_id, name: row.name, status: row.status, startDate: row.start_date, createdAt: row.created_at, updatedAt: row.updated_at })),
            });
            setProfile({ displayName: storedDisplayName || emailPrefix(email), email: email || "Signed-in account", avatarPath, avatarUrl });
            if (profileResult.error) setNotice("Your profile could not be loaded. Please try again.");
            setIsDemo(false); setReady(true); return;
          }
          if (!cancelled) {
            setData(EMPTY_DATA);
            setIsDemo(false);
            setNotice("RX Tasks could not load your workspace. Please try again.");
            setReady(true);
          }
          return;
        }
        if (!cancelled) {
          setData(EMPTY_DATA);
          setIsDemo(false);
          if (authError?.name !== "AuthSessionMissingError") setNotice("Your session could not be verified. Please sign in again.");
          setReady(true);
        }
        return;
      }
      if (!cancelled) { setData(readDemo()); setIsDemo(true); setReady(true); }
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (ready && isDemo) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, ready, isDemo]);

  const fail = useCallback((message: string) => setNotice(message), []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const name = displayName.trim();
    if (!name || isDemo || !supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("Authentication required");
    const { data: updated, error } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", auth.user.id)
      .select("display_name")
      .single();
    if (error) {
      fail("Your display name could not be saved.");
      throw error;
    }
    setProfile((current) => ({
      displayName: updated.display_name?.trim() || emailPrefix(auth.user.email ?? ""),
      email: current?.email ?? auth.user.email ?? "Signed-in account",
      avatarPath: current?.avatarPath ?? null,
      avatarUrl: current?.avatarUrl ?? null,
    }));
  }, [fail, isDemo, supabase]);

  const uploadProfilePhoto = useCallback(async (file: File) => {
    if (isDemo || !supabase) throw new Error("avatar-unavailable");
    const image = await prepareAvatar(file);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("avatar-auth");

    const path = `${auth.user.id}/${crypto.randomUUID()}.webp`;
    const uploaded = await supabase.storage.from("avatars").upload(path, image, { contentType: "image/webp", cacheControl: "3600", upsert: false });
    if (uploaded.error) {
      logMutationError("avatars.upload", uploaded.error);
      fail("Your profile photo could not be saved.");
      throw new Error("avatar-upload");
    }

    const signed = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed.error) {
      logMutationError("avatars.createSignedUrl", signed.error);
      await supabase.storage.from("avatars").remove([path]);
      fail("Your profile photo could not be saved.");
      throw new Error("avatar-upload");
    }

    const previousPath = profile?.avatarPath ?? null;
    const updated = await supabase.from("profiles").update({ avatar_path: path }).eq("id", auth.user.id).select("avatar_path").single();
    if (updated.error) {
      logMutationError("profiles.avatar.update", updated.error);
      await supabase.storage.from("avatars").remove([path]);
      fail("Your profile photo could not be saved.");
      throw new Error("avatar-profile");
    }

    setProfile((current) => current ? { ...current, avatarPath: path, avatarUrl: signed.data.signedUrl } : current);
    if (previousPath && previousPath !== path) {
      const cleanup = await supabase.storage.from("avatars").remove([previousPath]);
      if (cleanup.error) logMutationError("avatars.cleanup", cleanup.error);
    }
  }, [fail, isDemo, profile?.avatarPath, supabase]);

  const removeProfilePhoto = useCallback(async () => {
    if (isDemo || !supabase) throw new Error("avatar-unavailable");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error("avatar-auth");
    const previousPath = profile?.avatarPath ?? null;
    const updated = await supabase.from("profiles").update({ avatar_path: null }).eq("id", auth.user.id).select("id").single();
    if (updated.error) {
      logMutationError("profiles.avatar.remove", updated.error);
      fail("Your profile photo could not be removed.");
      throw new Error("avatar-profile");
    }
    setProfile((current) => current ? { ...current, avatarPath: null, avatarUrl: null } : current);
    if (previousPath) {
      const cleanup = await supabase.storage.from("avatars").remove([previousPath]);
      if (cleanup.error) {
        logMutationError("avatars.remove", cleanup.error);
        fail("The photo was removed, but storage cleanup could not be completed.");
      }
    }
  }, [fail, isDemo, profile?.avatarPath, supabase]);

  const createTask = useCallback(async (draft: TaskDraft) => {
    const created = now();
    const reminderId = draft.reminderOffset !== undefined && draft.reminderOffset !== null ? randomId() : null;
    const task: Task = {
      id: randomId(), userId: "demo", propertyId: draft.propertyId ?? null, campaignId: draft.campaignId ?? null,
      title: draft.title.trim(), description: draft.description?.trim() ?? "", category: draft.category ?? "task",
      priority: draft.priority ?? "normal", status: "todo", dueDate: draft.dueDate ?? localDate(), dueTime: draft.dueTime ?? null,
      recurrence: draft.recurrence ?? null, reminders: [],
      completedAt: null, createdAt: created, updatedAt: created,
    };
    if (reminderId) {
      const due = new Date(`${task.dueDate}T${task.dueTime ?? "09:00"}:00`); due.setMinutes(due.getMinutes() - (draft.reminderOffset ?? 0));
      task.reminders = [{ id: reminderId, taskId: task.id, remindAt: due.toISOString(), offsetMinutes: draft.reminderOffset ?? null, sentAt: null }];
    }
    if (!isDemo && supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Authentication required");
      task.userId = auth.user.id;
      const { error } = await supabase.from("tasks").insert(taskRow(task));
      if (error) { fail("The task could not be saved. Please try again."); throw error; }
      if (reminderId) {
        const due = new Date(`${task.dueDate}T${task.dueTime ?? "09:00"}:00`);
        due.setMinutes(due.getMinutes() - (draft.reminderOffset ?? 0));
        const { error: reminderError } = await supabase.from("task_reminders").insert({ id: reminderId, user_id: auth.user.id, task_id: task.id, remind_at: due.toISOString(), offset_minutes: draft.reminderOffset });
        if (reminderError) {
          task.reminders = [];
          fail("The task was saved, but its reminder could not be saved.");
        }
      }
    }
    setData((current) => ({ ...current, tasks: [task, ...current.tasks] }));
    return task;
  }, [fail, isDemo, supabase]);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    const updatedAt = now();
    if (!isDemo && supabase) {
      const dbPatch: Record<string, unknown> = { updated_at: updatedAt };
      const columns = {
        propertyId: "property_id", campaignId: "campaign_id", title: "title", description: "description",
        category: "category", priority: "priority", status: "status", dueDate: "due_date",
        dueTime: "due_time", recurrence: "recurrence_rule", completedAt: "completed_at",
      } as const;
      for (const [key, column] of Object.entries(columns) as [keyof typeof columns, string][]) {
        if (patch[key] !== undefined) dbPatch[column] = patch[key];
      }
      const { error } = await supabase.from("tasks").update(dbPatch).eq("id", id).select("id").single();
      if (error) { logMutationError("tasks.update", error); fail("Changes could not be saved."); return false; }
    }
    setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch, updatedAt } : task) }));
    return true;
  }, [fail, isDemo, supabase]);

  const deleteTask = useCallback(async (id: string) => {
    if (!isDemo && supabase) {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) { fail("The task could not be deleted."); return; }
    }
    setData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
  }, [fail, isDemo, supabase]);

  const toggleTask = useCallback(async (id: string) => {
    const task = data.tasks.find((item) => item.id === id);
    if (!task) return;
    const completing = task.status !== "completed";
    const saved = await updateTask(id, { status: completing ? "completed" : "todo", completedAt: completing ? now() : null });
    if (!saved) return;
    if (completing && task.recurrence) {
      await createTask({ ...task, dueDate: nextOccurrence(task.dueDate, task.recurrence), recurrence: task.recurrence });
    }
  }, [createTask, data.tasks, updateTask]);

  const setTaskReminder = useCallback(async (id: string, offsetMinutes: number | null, schedule?: Pick<Task, "dueDate" | "dueTime">) => {
    const task = data.tasks.find((item) => item.id === id); if (!task) return false;
    const reminderId = task.reminders[0]?.id ?? randomId();
    const dueDate = schedule?.dueDate ?? task.dueDate;
    const dueTime = schedule?.dueTime ?? task.dueTime;
    const due = new Date(`${dueDate}T${dueTime ?? "09:00"}:00`); due.setMinutes(due.getMinutes() - (offsetMinutes ?? 0));
    const reminders = offsetMinutes === null ? [] : [{ id: reminderId, taskId: id, remindAt: due.toISOString(), offsetMinutes, sentAt: null }];
    if (!isDemo && supabase) {
      const { data: auth } = await supabase.auth.getUser(); if (!auth.user) return false;
      const { error: deleteError } = await supabase.from("task_reminders").delete().eq("task_id", id);
      if (deleteError) { logMutationError("task_reminders.delete", deleteError); fail("The reminder could not be updated."); return false; }
      if (offsetMinutes !== null) {
        const { error } = await supabase.from("task_reminders").insert({ id: reminderId, user_id: auth.user.id, task_id: id, remind_at: due.toISOString(), offset_minutes: offsetMinutes });
        if (error) {
          setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, reminders: [] } : item) }));
          logMutationError("task_reminders.insert", error);
          fail("The reminder could not be saved.");
          return false;
        }
      }
    }
    setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, reminders } : item) }));
    return true;
  }, [data.tasks, fail, isDemo, supabase]);

  const createProperty = useCallback(async (input: { name: string; address: string; description?: string; status?: PropertyStatus }) => {
    const timestamp = now();
    const property: Property = { id: randomId(), userId: "demo", name: input.name.trim(), address: input.address.trim(), description: input.description?.trim() ?? "", status: input.status ?? "new", createdAt: timestamp, updatedAt: timestamp };
    if (!isDemo && supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Authentication required");
      property.userId = auth.user.id;
      const { error } = await supabase.from("properties").insert({ id: property.id, user_id: property.userId, name: property.name, address: property.address, description: property.description, status: property.status });
      if (error) { fail("The property could not be saved."); throw error; }
    }
    setData((current) => ({ ...current, properties: [property, ...current.properties] }));
    return property;
  }, [fail, isDemo, supabase]);

  const updateProperty = useCallback(async (id: string, patch: Partial<Property>) => {
    if (!isDemo && supabase) {
      const dbPatch: Record<string, unknown> = {};
      for (const key of ["name", "address", "description", "status"] as const) if (patch[key] !== undefined) dbPatch[key] = patch[key];
      const { error } = await supabase.from("properties").update(dbPatch).eq("id", id).select("id").single();
      if (error) { logMutationError("properties.update", error); fail("Changes could not be saved."); return false; }
    }
    setData((current) => ({ ...current, properties: current.properties.map((property) => property.id === id ? { ...property, ...patch, updatedAt: now() } : property) }));
    return true;
  }, [fail, isDemo, supabase]);

  const deleteProperty = useCallback(async (id: string) => {
    if (!isDemo && supabase) {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) { fail("Archive or detach its tasks before deleting this property."); return; }
    }
    setData((current) => ({ ...current, properties: current.properties.filter((property) => property.id !== id), tasks: current.tasks.map((task) => task.propertyId === id ? { ...task, propertyId: null } : task) }));
  }, [fail, isDemo, supabase]);

  const launchCampaign = useCallback(async (propertyId: string, startDate: string) => {
    const property = data.properties.find((item) => item.id === propertyId);
    if (!property) return;
    const timestamp = now();
    const campaign: Campaign = { id: randomId(), userId: property.userId, propertyId, templateId: "new-property", name: "New Property Launch", status: "active", startDate, createdAt: timestamp, updatedAt: timestamp };
    const template = [
      [0, "Prepare / check photographs"], [0, "Write property description"], [1, "Publish on real estate portals"],
      [1, "Publish on RX website"], [1, "Prepare social media content"], [1, "Launch social media campaign"],
      [3, "Check campaign performance"], [7, "Review results and make adjustments"],
    ] as const;
    if (!isDemo && supabase) {
      const { error } = await supabase.rpc("launch_campaign_from_template", { p_property_id: propertyId, p_template_slug: "new-property-campaign", p_start_date: startDate });
      if (error) { fail("The campaign could not be launched."); return; }
      window.location.reload(); return;
    }
    const tasks = template.map(([offset, title]) => ({
      id: randomId(), userId: property.userId, propertyId, campaignId: campaign.id, title, description: "Generated from the New Property Campaign template.",
      category: "campaign" as const, priority: "normal" as const, status: "todo" as const,
      dueDate: format(addDays(new Date(`${startDate}T12:00:00`), offset), "yyyy-MM-dd"), dueTime: null, recurrence: null, reminders: [], completedAt: null, createdAt: timestamp, updatedAt: timestamp,
    }));
    setData((current) => ({ ...current, campaigns: [campaign, ...current.campaigns], tasks: [...tasks, ...current.tasks] }));
    setNotice("New Property Campaign created with 8 tasks.");
  }, [data.properties, fail, isDemo, supabase]);

  const value = useMemo(() => ({ ...data, ready, isDemo, profile, notice, clearNotice: () => setNotice(null), createTask, updateTask, deleteTask, toggleTask, setTaskReminder, createProperty, updateProperty, deleteProperty, launchCampaign, updateDisplayName, uploadProfilePhoto, removeProfilePhoto }), [data, ready, isDemo, profile, notice, createTask, updateTask, deleteTask, toggleTask, setTaskReminder, createProperty, updateProperty, deleteProperty, launchCampaign, updateDisplayName, uploadProfilePhoto, removeProfilePhoto]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used within AppProvider");
  return value;
}
