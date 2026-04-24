import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, FileText, ClipboardList, Upload, Calendar, Hash,
  BookOpen, X, File, ImageIcon, Film,
} from "lucide-react";

interface CreateAssignmentDialogProps {
  courseId: string;
  doctorId: string;
}

type ContentType = "assignment" | "material";

// ── file type helpers ────────────────────────────────────────────────────────
function fileIcon(file: File) {
  if (file.type.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-sky-400" />;
  if (file.type.startsWith("video/")) return <Film className="w-4 h-4 text-violet-400" />;
  return <File className="w-4 h-4 text-amber-400" />;
}
function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── AM/PM time picker component ──────────────────────────────────────────────
function TimePicker({
  value,
  onChange,
}: {
  value: { hour: string; minute: string; ampm: "AM" | "PM" };
  onChange: (v: { hour: string; minute: string; ampm: "AM" | "PM" }) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {/* Hour */}
      <Select value={value.hour} onValueChange={(h) => onChange({ ...value, hour: h })}>
        <SelectTrigger className="rounded-xl h-9 w-16 text-xs">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-white/40 text-sm font-bold">:</span>

      {/* Minute */}
      <Select value={value.minute} onValueChange={(m) => onChange({ ...value, minute: m })}>
        <SelectTrigger className="rounded-xl h-9 w-16 text-xs">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM / PM toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/[0.1]"
        style={{ background: "hsl(225 25% 10%)" }}>
        {(["AM", "PM"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange({ ...value, ampm: p })}
            className="px-2.5 py-1.5 text-[11px] font-bold transition-all"
            style={value.ampm === p ? {
              background: "hsl(217 91% 60% / 0.25)",
              color: "hsl(217 91% 60%)",
            } : { color: "hsl(218 11% 45%)" }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export default function CreateAssignmentDialog({ courseId, doctorId }: CreateAssignmentDialogProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver]   = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    rubric: "",
    max_score: "100",
    due_date: "",   // YYYY-MM-DD
    week_number: "1",
  });

  const [time, setTime] = useState<{ hour: string; minute: string; ampm: "AM" | "PM" }>({
    hour: "11",
    minute: "59",
    ampm: "PM",
  });

  // ── reset ──
  function reset() {
    setContentType(null);
    setForm({ title: "", description: "", rubric: "", max_score: "100", due_date: "", week_number: "1" });
    setTime({ hour: "11", minute: "59", ampm: "PM" });
    setAttachedFiles([]);
  }

  // ── file handling ──
  function addFiles(files: FileList | null) {
    if (!files) return;
    const maxSize = 50 * 1024 * 1024; // 50 MB
    const valid = Array.from(files).filter((f) => {
      if (f.size > maxSize) { toast.error(`${f.name} exceeds 50 MB limit`); return false; }
      return true;
    });
    setAttachedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setAttachedFiles((prev) => prev.filter((f) => f.name !== name));
  }

  // ── build ISO due_date ──
  function buildDueDate(): string | null {
    if (!form.due_date) return null;
    let h = parseInt(time.hour);
    if (time.ampm === "PM" && h !== 12) h += 12;
    if (time.ampm === "AM" && h === 12) h = 0;
    const hStr = String(h).padStart(2, "0");
    return new Date(`${form.due_date}T${hStr}:${time.minute}:00`).toISOString();
  }

  // ── upload files to Python backend (no Supabase storage needed) ──
  async function uploadFiles(_assignmentId: string): Promise<string[]> {
    const urls: string[] = [];
    for (const file of attachedFiles) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          toast.error(`Upload failed for ${file.name}: ${err.error ?? res.statusText}`);
          continue;
        }
        const result = await res.json();
        urls.push(result.url);
        toast.success(`Uploaded: ${file.name}`);
      } catch (err: any) {
        toast.error(`Could not reach upload server. Make sure the Python backend is running (python trackify_backend.py).`);
        break;
      }
    }
    return urls;
  }

  // ── submit ──
  async function handleSubmit() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!contentType) { toast.error("Select content type"); return; }

    // ── MATERIAL: save to course_materials table ──
    if (contentType === "material") {
      if (attachedFiles.length === 0) { toast.error("Please attach at least one file"); return; }
      setLoading(true);
      setUploading(true);
      try {
        const urls = await uploadFiles("");
        const toInsert = attachedFiles.map((f, i) => ({
          course_id:   courseId,
          doctor_id:   doctorId,
          title:       form.title.trim(),
          description: form.description.trim() || null,
          file_url:    urls[i] ?? null,
          file_name:   f.name,
          file_size:   f.size,
          file_type:   f.name.split(".").pop()?.toLowerCase() ?? "file",
          week_number: parseInt(form.week_number) || null,
        }));
        const { error } = await supabase.from("course_materials").insert(toInsert as any);
        if (error) throw error;
        toast.success(`Material${attachedFiles.length > 1 ? "s" : ""} uploaded successfully`);
        qc.invalidateQueries({ queryKey: ["course-materials", courseId] });
        setOpen(false);
        reset();
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
        setUploading(false);
      }
      return;
    }

    // ── ASSIGNMENT: save to assignments table ──
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        course_id:   courseId,
        doctor_id:   doctorId,
        title:       form.title.trim(),
        description: form.description.trim() || null,
        week_number: parseInt(form.week_number) || null,
        rubric:      form.rubric.trim() || null,
        max_score:   parseInt(form.max_score) || 100,
        due_date:    buildDueDate(),
      };

      const { data, error } = await supabase
        .from("assignments")
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;

      // Upload attached files if any
      if (attachedFiles.length > 0 && data?.id) {
        setUploading(true);
        const urls = await uploadFiles(data.id);
        if (urls.length > 0) {
          const fileLinks = urls.map((u, i) => `[${attachedFiles[i]?.name ?? "file"}](${u})`).join("\n");
          await supabase.from("assignments").update({
            description: payload.description
              ? `${payload.description}\n\n**Attachments:**\n${fileLinks}`
              : `**Attachments:**\n${fileLinks}`,
          }).eq("id", data.id);
        }
        setUploading(false);
      }

      toast.success("Assignment created successfully");
      qc.invalidateQueries({ queryKey: ["assignments", courseId] });
      setOpen(false);
      reset();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-7 text-[11px] rounded-lg gap-1 px-2.5 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }}
        >
          <Plus className="w-3 h-3" /> Add
        </Button>
      </DialogTrigger>

      <DialogContent className="glass max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/[0.07] flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4 text-primary" />
            Add Course Content
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* ── Step 1: Type selector ── */}
          {!contentType ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">What would you like to add?</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    type: "assignment" as ContentType,
                    icon: <ClipboardList className="w-6 h-6" />,
                    label: "Assignment",
                    desc: "Set deadline, rubric & accept student submissions",
                    color: "#a78bfa",
                  },
                  {
                    type: "material" as ContentType,
                    icon: <FileText className="w-6 h-6" />,
                    label: "Material",
                    desc: "Upload PDFs, videos, docs for students",
                    color: "#38bdf8",
                  },
                ].map(({ type, icon, label, desc, color }) => (
                  <motion.button
                    key={type}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setContentType(type)}
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all text-center"
                    style={{ border: `2px solid ${color}35`, background: `${color}08` }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: `${color}18`, color }}>
                      {icon}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Step 2: Form ── */
            <div className="space-y-4">
              {/* Back */}
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                onClick={() => setContentType(null)}
              >
                ← Change type
              </button>

              {/* Type badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{
                  background: contentType === "assignment" ? "hsl(263 70% 58% / 0.1)" : "hsl(201 96% 50% / 0.1)",
                  border: contentType === "assignment" ? "1px solid hsl(263 70% 58% / 0.25)" : "1px solid hsl(201 96% 50% / 0.25)",
                }}>
                {contentType === "assignment"
                  ? <ClipboardList className="w-4 h-4 text-violet-400" />
                  : <FileText className="w-4 h-4 text-sky-400" />}
                <span className="text-sm font-bold capitalize text-foreground">{contentType}</span>
              </div>

              {/* Title */}
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                  <Hash className="w-3 h-3" /> Title *
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={contentType === "assignment" ? "e.g. Chapter 3 Problem Set" : "e.g. Lecture 4 Slides"}
                  className="rounded-xl"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs mb-1.5 block">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={contentType === "assignment"
                    ? "Describe what students need to do..."
                    : "Brief description of this material..."}
                  className="rounded-xl resize-none"
                  rows={3}
                />
              </div>

              {/* Week */}
              <div>
                <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" /> Week
                </Label>
                <Select value={form.week_number}
                  onValueChange={(v) => setForm({ ...form, week_number: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
                      <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ── Assignment-only fields ── */}
              {contentType === "assignment" && (
                <>
                  {/* Max score */}
                  <div>
                    <Label className="text-xs mb-1.5 block">Max Score</Label>
                    <Input
                      type="number"
                      value={form.max_score}
                      onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                      min={1} max={1000}
                      className="rounded-xl w-32"
                    />
                  </div>

                  {/* Due date + time with AM/PM */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> Due Date & Time
                    </Label>
                    <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/[0.08]"
                      style={{ background: "hsl(225 25% 8%)" }}>
                      {/* Date */}
                      <Input
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                        className="rounded-xl h-9 text-sm"
                      />
                      {/* Time */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 uppercase tracking-widest w-8">Time</span>
                        <TimePicker value={time} onChange={setTime} />
                      </div>
                    </div>
                  </div>

                  {/* Grading Rubric */}
                  <div>
                    <Label className="text-xs mb-1.5 block">Grading Rubric</Label>
                    <Textarea
                      value={form.rubric}
                      onChange={(e) => setForm({ ...form, rubric: e.target.value })}
                      placeholder="e.g. 40% correctness, 30% explanation, 20% examples, 10% formatting..."
                      className="rounded-xl resize-none"
                      rows={3}
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Used by AI grading to evaluate the submission.
                    </p>
                  </div>
                </>
              )}

              {/* ── File Upload (both types) ── */}
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                  <Upload className="w-3 h-3" />
                  {contentType === "assignment" ? "Attachments (optional)" : "Upload Files"}
                </Label>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                  style={{
                    borderColor: dragOver ? "hsl(217 91% 60% / 0.6)" : "hsl(217 91% 60% / 0.2)",
                    background: dragOver ? "hsl(217 91% 60% / 0.06)" : "hsl(225 25% 8%)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "hsl(217 91% 60% / 0.12)" }}>
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/70">
                      {dragOver ? "Drop files here" : "Click or drag & drop files"}
                    </p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      PDF, Word, images, videos — max 50 MB each
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.mp4,.mov,.zip"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>

                {/* File list */}
                {attachedFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {attachedFiles.map((file) => (
                      <div key={file.name}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.06]"
                        style={{ background: "hsl(225 25% 10%)" }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "hsl(225 25% 14%)" }}>
                          {fileIcon(file)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/80 truncate">{file.name}</p>
                          <p className="text-[10px] text-white/30">{fmtBytes(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(file.name)}
                          className="text-white/20 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — always visible */}
        {contentType && (
          <div className="px-6 py-4 border-t border-white/[0.07] flex-shrink-0">
            <Button
              onClick={handleSubmit}
              disabled={loading || uploading}
              className="w-full rounded-xl h-11 font-semibold gap-2"
              style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }}
            >
              {uploading ? (
                <><span className="animate-spin">⏳</span> Uploading files...</>
              ) : loading ? (
                "Creating..."
              ) : (
                <>
                  {contentType === "assignment"
                    ? <ClipboardList className="w-4 h-4" />
                    : <FileText className="w-4 h-4" />}
                  Create {contentType === "assignment" ? "Assignment" : "Material"}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
