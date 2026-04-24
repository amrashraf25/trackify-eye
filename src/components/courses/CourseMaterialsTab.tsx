import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Download, Trash2, FileText, File, BookOpen,
  Presentation, Table2, Image, Archive, Code2, Video,
  Plus, X, Loader2, FolderOpen, ExternalLink, Search,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── File type helpers ──────────────────────────────────────────────────────────

type FileKind = "pdf" | "word" | "excel" | "ppt" | "image" | "video" | "code" | "zip" | "other";

function getFileKind(name: string): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["py", "js", "ts", "cpp", "c", "java", "html", "css", "json"].includes(ext)) return "code";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  return "other";
}

const KIND_CONFIG: Record<FileKind, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pdf:   { color: "#ef4444", bg: "#ef444415", icon: <FileText className="w-5 h-5" />, label: "PDF" },
  word:  { color: "#3b82f6", bg: "#3b82f615", icon: <FileText className="w-5 h-5" />, label: "DOCX" },
  excel: { color: "#22c55e", bg: "#22c55e15", icon: <Table2  className="w-5 h-5" />, label: "XLSX" },
  ppt:   { color: "#f97316", bg: "#f9731615", icon: <Presentation className="w-5 h-5" />, label: "PPTX" },
  image: { color: "#ec4899", bg: "#ec489915", icon: <Image   className="w-5 h-5" />, label: "IMG" },
  video: { color: "#a78bfa", bg: "#a78bfa15", icon: <Video   className="w-5 h-5" />, label: "VID" },
  code:  { color: "#38bdf8", bg: "#38bdf815", icon: <Code2   className="w-5 h-5" />, label: "CODE" },
  zip:   { color: "#fb923c", bg: "#fb923c15", icon: <Archive className="w-5 h-5" />, label: "ZIP" },
  other: { color: "#94a3b8", bg: "#94a3b815", icon: <File    className="w-5 h-5" />, label: "FILE" },
};

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Upload dialog ──────────────────────────────────────────────────────────────

function UploadMaterialDialog({ courseId, doctorId, onDone }: {
  courseId: string; doctorId: string; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [week, setWeek] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(fl: FileList | null) {
    if (!fl) return;
    setFiles(prev => [...prev, ...Array.from(fl).filter(f => f.size < 100 * 1024 * 1024)]);
  }

  function reset() {
    setTitle(""); setDescription(""); setWeek(""); setFiles([]); setOpen(false);
  }

  async function uploadFile(file: File): Promise<{ url: string; size: number } | null> {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: form });
      if (!res.ok) return null;
      const data = await res.json();
      return { url: data.url as string, size: file.size };
    } catch { return null; }
  }

  async function handleUpload() {
    if (!title.trim()) { toast.error("Please enter a title"); return; }
    if (files.length === 0) { toast.error("Please attach at least one file"); return; }
    setLoading(true);
    try {
      const results = await Promise.all(files.map(f => uploadFile(f)));
      const toInsert = files.map((f, i) => ({
        course_id:   courseId,
        doctor_id:   doctorId,
        title:       title.trim(),
        description: description.trim() || null,
        file_url:    results[i]?.url ?? null,
        file_name:   f.name,
        file_size:   f.size,
        file_type:   f.name.split(".").pop()?.toLowerCase() ?? "file",
        week_number: parseInt(week) || null,
        created_at:  new Date().toISOString(),
      }));

      const { error } = await supabase.from("course_materials").insert(toInsert as any);
      if (error) throw error;
      toast.success(`${files.length} material${files.length > 1 ? "s" : ""} uploaded`);
      onDone();
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 rounded-xl text-sm font-bold"
        style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }}
      >
        <Plus className="w-4 h-4" /> Upload Materials
      </Button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-lg rounded-2xl border border-white/[0.08] overflow-hidden"
              style={{ background: "hsl(225 25% 8%)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "hsl(217 91% 60% / 0.15)" }}>
                    <Upload className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Upload Course Materials</p>
                    <p className="text-[10px] text-white/35">Slides, PDFs, notes — visible to all students</p>
                  </div>
                </div>
                <button onClick={reset} className="text-white/30 hover:text-white/70 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                <div>
                  <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 block">
                    Title *
                  </Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Week 3 — Lecture Slides"
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 block">
                      Week (optional)
                    </Label>
                    <Input
                      type="number"
                      value={week}
                      onChange={e => setWeek(e.target.value)}
                      placeholder="e.g. 3"
                      min={1} max={16}
                      className="rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 block">
                      Description (optional)
                    </Label>
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Short note..."
                      className="rounded-xl"
                    />
                  </div>
                </div>

                {/* Drop zone */}
                <div>
                  <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 block">
                    Files *
                  </Label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                    className="rounded-xl border-2 border-dashed border-white/10 p-6 text-center cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition-all"
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2 text-white/25" />
                    <p className="text-xs text-white/40">Drop files here or <span className="text-blue-400 font-semibold">browse</span></p>
                    <p className="text-[10px] text-white/20 mt-1">PDF, PPTX, DOCX, images, videos — up to 100 MB each</p>
                  </div>
                  <input ref={fileRef} type="file" multiple className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif,.mp4,.mov,.zip,.py,.js,.ts,.cpp,.c,.java"
                    onChange={e => addFiles(e.target.files)} />
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {files.map((f, i) => {
                      const kind = getFileKind(f.name);
                      const cfg  = KIND_CONFIG[kind];
                      return (
                        <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg border border-white/[0.06]"
                          style={{ background: "hsl(225 25% 6%)" }}>
                          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 font-medium truncate">{f.name}</p>
                            <p className="text-[10px] text-white/30">{formatBytes(f.size)}</p>
                          </div>
                          <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                            className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={reset} className="flex-1 rounded-xl">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={loading || !title.trim() || files.length === 0}
                    className="flex-1 rounded-xl gap-2 font-bold"
                    style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {loading ? "Uploading..." : `Upload ${files.length > 0 ? `(${files.length})` : ""}`}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Material Card (Student view) ───────────────────────────────────────────────

function MaterialCard({ mat }: { mat: any }) {
  const kind = getFileKind(mat.file_name ?? "");
  const cfg  = KIND_CONFIG[kind];
  const ext  = (mat.file_name ?? "").split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group relative rounded-2xl border border-white/[0.07] overflow-hidden transition-all hover:border-white/15 hover:shadow-lg"
      style={{ background: "hsl(225 25% 7%)" }}
    >
      {/* Color accent top bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color}20)` }} />

      <div className="p-4">
        {/* File icon + ext badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.bg, border: `1px solid ${cfg.color}25`, color: cfg.color }}>
            {cfg.icon}
          </div>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-lg tracking-wider"
            style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
            {ext}
          </span>
        </div>

        {/* Title & meta */}
        <p className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">{mat.title}</p>
        {mat.description && (
          <p className="text-[11px] text-white/40 leading-relaxed mb-2 line-clamp-2">{mat.description}</p>
        )}

        <div className="flex items-center gap-2 text-[10px] text-white/25 mb-3">
          {mat.week_number && (
            <span className="px-1.5 py-0.5 rounded-md" style={{ background: "hsl(225 20% 12%)" }}>
              Week {mat.week_number}
            </span>
          )}
          {mat.file_size && <span>{formatBytes(mat.file_size)}</span>}
          <span className="ml-auto">{format(new Date(mat.created_at), "MMM dd, yyyy")}</span>
        </div>

        {/* Download button */}
        <a
          href={mat.file_url}
          download={mat.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}10)`,
            color: cfg.color,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>
    </motion.div>
  );
}

// ── Doctor Material Row ────────────────────────────────────────────────────────

function DoctorMaterialRow({ mat, onDelete }: { mat: any; onDelete: () => void }) {
  const kind = getFileKind(mat.file_name ?? "");
  const cfg  = KIND_CONFIG[kind];
  const ext  = (mat.file_name ?? "").split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] hover:border-white/10 transition-all group"
      style={{ background: "hsl(225 25% 7%)" }}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
        {cfg.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-white truncate">{mat.title}</p>
          {mat.week_number && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)" }}>
              W{mat.week_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          <span className="font-mono" style={{ color: cfg.color }}>{ext}</span>
          <span>·</span>
          <span className="truncate">{mat.file_name}</span>
          {mat.file_size && <><span>·</span><span>{formatBytes(mat.file_size)}</span></>}
          <span>·</span>
          <span>{format(new Date(mat.created_at), "MMM dd, yyyy")}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={mat.file_url}
          download={mat.file_name}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
          style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
        >
          <Download className="w-3 h-3" /> Download
        </a>
        <a
          href={mat.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg transition-all hover:scale-105 text-white/30 hover:text-white/60"
          style={{ background: "hsl(225 25% 10%)", border: "1px solid hsl(225 20% 15%)" }}
        >
          <ExternalLink className="w-3 h-3" />
        </a>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="p-1.5 rounded-lg transition-all hover:scale-105 text-red-400/50 hover:text-red-400"
              style={{ background: "#ef444412", border: "1px solid #ef444420" }}>
              <Trash2 className="w-3 h-3" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Material?</AlertDialogTitle>
              <AlertDialogDescription>
                "{mat.title}" will be permanently removed. Students will lose access to this file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}
                className="rounded-xl bg-red-500 hover:bg-red-600">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
  doctorId?: string;
  isDoctor: boolean;
}

export default function CourseMaterialsTab({ courseId, doctorId, isDoctor }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [weekFilter, setWeekFilter] = useState<number | null>(null);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["course-materials", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_materials")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleDelete(id: string) {
    const { error } = await supabase.from("course_materials").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Material deleted");
    qc.invalidateQueries({ queryKey: ["course-materials", courseId] });
  }

  // Unique weeks for filter
  const weeks = [...new Set(materials.map((m: any) => m.week_number).filter(Boolean))].sort((a: any, b: any) => a - b);

  // Filter
  const filtered = materials.filter((m: any) => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase()) ||
      (m.file_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchWeek = weekFilter === null || m.week_number === weekFilter;
    return matchSearch && matchWeek;
  });

  // Group by week
  const grouped: Record<string, any[]> = {};
  filtered.forEach((m: any) => {
    const key = m.week_number ? `Week ${m.week_number}` : "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "General") return 1;
    if (b === "General") return -1;
    return parseInt(a.replace("Week ", "")) - parseInt(b.replace("Week ", ""));
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-black text-white">Course Materials</h3>
          <p className="text-xs text-white/35 mt-0.5">
            {materials.length} file{materials.length !== 1 ? "s" : ""} · Slides, PDFs, notes for students
          </p>
        </div>
        {isDoctor && doctorId && (
          <UploadMaterialDialog
            courseId={courseId}
            doctorId={doctorId}
            onDone={() => qc.invalidateQueries({ queryKey: ["course-materials", courseId] })}
          />
        )}
      </div>

      {/* Search + week filter */}
      {materials.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs border border-white/[0.08] text-white/70 placeholder-white/25 outline-none focus:border-blue-500/40 transition-all"
              style={{ background: "hsl(225 25% 7%)" }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setWeekFilter(null)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={weekFilter === null
                ? { background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.3)" }
                : { background: "hsl(225 25% 8%)", color: "hsl(218 11% 50%)", border: "1px solid hsl(225 20% 14%)" }
              }
            >All</button>
            {weeks.map((w: any) => (
              <button
                key={w}
                onClick={() => setWeekFilter(weekFilter === w ? null : w)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={weekFilter === w
                  ? { background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.3)" }
                  : { background: "hsl(225 25% 8%)", color: "hsl(218 11% 50%)", border: "1px solid hsl(225 20% 14%)" }
                }
              >W{w}</button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-white/20" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && materials.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-white/[0.08]"
          style={{ background: "hsl(225 25% 6%)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "hsl(217 91% 60% / 0.08)" }}>
            <BookOpen className="w-7 h-7 text-white/15" />
          </div>
          <p className="text-sm font-bold text-white/30">No materials yet</p>
          <p className="text-xs text-white/20 mt-1 max-w-xs">
            {isDoctor
              ? "Upload slides, PDFs, or notes using the button above."
              : "Your doctor hasn't uploaded any materials for this course yet."}
          </p>
        </div>
      )}

      {/* No results */}
      {!isLoading && materials.length > 0 && filtered.length === 0 && (
        <div className="text-center py-10 text-white/25 text-xs">
          No materials match your search.
        </div>
      )}

      {/* DOCTOR VIEW — list layout */}
      {isDoctor && filtered.length > 0 && (
        <div className="space-y-4">
          <AnimatePresence>
            {groupKeys.map(group => (
              <GroupSection key={group} title={group} count={grouped[group].length}>
                <div className="space-y-2">
                  {grouped[group].map((mat: any) => (
                    <DoctorMaterialRow
                      key={mat.id}
                      mat={mat}
                      onDelete={() => handleDelete(mat.id)}
                    />
                  ))}
                </div>
              </GroupSection>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* STUDENT VIEW — card grid */}
      {!isDoctor && filtered.length > 0 && (
        <div className="space-y-6">
          {groupKeys.map(group => (
            <GroupSection key={group} title={group} count={grouped[group].length}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {grouped[group].map((mat: any) => (
                    <MaterialCard key={mat.id} mat={mat} />
                  ))}
                </AnimatePresence>
              </div>
            </GroupSection>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Group collapsible section ──────────────────────────────────────────────────
function GroupSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 mb-2.5 w-full text-left group"
      >
        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{title}</span>
        <span className="text-[10px] text-white/20 font-mono">({count})</span>
        <div className="flex-1 h-px" style={{ background: "hsl(225 20% 12%)" }} />
        {open
          ? <ChevronUp className="w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />
          : <ChevronDown className="w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
