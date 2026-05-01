import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type VideoLabel =
  | "fight"
  | "smoking"
  | "aggression"
  | "phone_usage"
  | "sleeping";

export interface VideoClip {
  id: string;
  cameraId: string;
  cameraName: string;
  durationSeconds: number;
  timestamp: string;  // ISO-8601
  tagged: boolean;
  label: string | null;
  thumbnailUrl?: string;
}

export interface TagSummary {
  total: number;
  tagged: number;
  untagged: number;
  byLabel: Record<string, number>;
}

export interface TagValidationResult {
  valid: boolean;
  reason?: string;
}

// ─── VALID LABELS ─────────────────────────────────────────────────────────────

const VALID_LABELS: readonly VideoLabel[] = [
  "fight",
  "smoking",
  "aggression",
  "phone_usage",
  "sleeping",
];

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true when `label` is one of the recognised training labels.
 */
export function isValidLabel(label: string): boolean {
  return (VALID_LABELS as readonly string[]).includes(label);
}

/**
 * Filters clips to those matching the given label.
 * Pass "all" to return every clip regardless of label.
 */
export function filterByLabel(clips: VideoClip[], label: string): VideoClip[] {
  if (label === "all") return clips;
  return clips.filter((c) => c.label === label);
}

/**
 * Filters clips to those that are tagged (tagged === true) or untagged (tagged === false).
 */
export function filterByTagged(clips: VideoClip[], tagged: boolean): VideoClip[] {
  return clips.filter((c) => c.tagged === tagged);
}

/**
 * Builds an aggregated summary of the clip collection.
 */
export function buildTagSummary(clips: VideoClip[]): TagSummary {
  const tagged = clips.filter((c) => c.tagged).length;
  const byLabel: Record<string, number> = {};

  for (const clip of clips) {
    if (clip.tagged && clip.label) {
      byLabel[clip.label] = (byLabel[clip.label] ?? 0) + 1;
    }
  }

  return {
    total: clips.length,
    tagged,
    untagged: clips.length - tagged,
    byLabel,
  };
}

/**
 * Returns a new array sorted by clip timestamp.
 * direction "asc" = oldest first, "desc" = newest first.
 * Does NOT mutate the original array.
 */
export function sortClipsByDate(
  clips: VideoClip[],
  direction: "asc" | "desc"
): VideoClip[] {
  return [...clips].sort((a, b) => {
    const diff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

/**
 * Validates whether a clip can be tagged with the given label.
 * Fails when:
 *  - label is not a recognised valid label
 *  - clip is already tagged with the exact same label
 */
export function validateClipForTag(
  clip: VideoClip,
  label: string
): TagValidationResult {
  if (!isValidLabel(label)) {
    return { valid: false, reason: `"${label}" is not a recognised label.` };
  }
  if (clip.tagged && clip.label === label) {
    return {
      valid: false,
      reason: `Clip is already tagged as "${label}".`,
    };
  }
  return { valid: true };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

type TabValue = "all" | "tagged" | "untagged";

const TAB_LABELS: Record<TabValue, string> = {
  all: "All Clips",
  tagged: "Tagged",
  untagged: "Untagged",
};

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  fight: { bg: "hsl(0 72% 51% / 0.15)", text: "hsl(0 72% 65%)" },
  smoking: { bg: "hsl(38 92% 50% / 0.15)", text: "hsl(38 92% 65%)" },
  aggression: { bg: "hsl(280 80% 60% / 0.15)", text: "hsl(280 80% 75%)" },
  phone_usage: { bg: "hsl(217 91% 60% / 0.15)", text: "hsl(217 91% 75%)" },
  sleeping: { bg: "hsl(142 71% 45% / 0.15)", text: "hsl(142 71% 60%)" },
};

const VideoTagging = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<VideoLabel>("fight");
  const [tagError, setTagError] = useState<string | null>(null);

  // ─── Fetch clips ─────────────────────────────────────────────────────────────
  const { data: rawClips = [], isLoading } = useQuery<VideoClip[]>({
    queryKey: ["video_clips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_clips")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        cameraId: row.camera_id,
        cameraName: row.camera_name ?? row.camera_id,
        durationSeconds: row.duration_seconds ?? 0,
        timestamp: row.timestamp,
        tagged: row.tagged ?? false,
        label: row.label ?? null,
        thumbnailUrl: row.thumbnail_url ?? undefined,
      }));
    },
  });

  // ─── Tag mutation ─────────────────────────────────────────────────────────────
  const tagMutation = useMutation({
    mutationFn: async ({
      clipId,
      label,
    }: {
      clipId: string;
      label: string;
    }) => {
      const { error } = await supabase
        .from("video_clips")
        .update({ tagged: true, label })
        .eq("id", clipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video_clips"] });
      setSelectedClipId(null);
      setTagError(null);
    },
  });

  // ─── Derived data ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => buildTagSummary(rawClips), [rawClips]);

  const visibleClips = useMemo(() => {
    if (activeTab === "tagged") return filterByTagged(rawClips, true);
    if (activeTab === "untagged") return filterByTagged(rawClips, false);
    return rawClips;
  }, [rawClips, activeTab]);

  const selectedClip = useMemo(
    () => rawClips.find((c) => c.id === selectedClipId) ?? null,
    [rawClips, selectedClipId]
  );

  const handleTagClip = () => {
    if (!selectedClip) return;
    const validation = validateClipForTag(selectedClip, pendingLabel);
    if (!validation.valid) {
      setTagError(validation.reason ?? "Invalid tag.");
      return;
    }
    setTagError(null);
    tagMutation.mutate({ clipId: selectedClip.id, label: pendingLabel });
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-white/90 tracking-tight">
          Video Tagging
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Label video clips for model retraining. Tagged clips are isolated in
          the training dataset view.
        </p>
      </motion.div>

      {/* Summary bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
      >
        {/* Total */}
        <div
          className="rounded-xl border border-white/[0.07] px-4 py-3"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <p className="text-xs text-white/40 mb-1">Total</p>
          <p className="text-xl font-bold text-white/90">{summary.total}</p>
        </div>
        {/* Tagged */}
        <div
          className="rounded-xl border border-white/[0.07] px-4 py-3"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <p className="text-xs text-white/40 mb-1">Tagged</p>
          <p className="text-xl font-bold text-white/90">{summary.tagged}</p>
        </div>
        {/* Untagged */}
        <div
          className="rounded-xl border border-white/[0.07] px-4 py-3"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <p className="text-xs text-white/40 mb-1">Untagged</p>
          <p className="text-xl font-bold text-white/90">{summary.untagged}</p>
        </div>
        {/* Per-label counts */}
        {VALID_LABELS.map((lbl) => (
          <div
            key={lbl}
            className="rounded-xl border border-white/[0.07] px-4 py-3"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <p className="text-xs text-white/40 mb-1 capitalize">
              {lbl.replace("_", " ")}
            </p>
            <p className="text-xl font-bold text-white/90">
              {summary.byLabel[lbl] ?? 0}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Main split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: clip list ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          {/* Card header + tabs */}
          <div
            className="px-5 py-4 border-b border-white/[0.06]"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <div className="flex gap-2">
              {(["all", "tagged", "untagged"] as TabValue[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background:
                      activeTab === tab
                        ? "hsl(217 91% 60% / 0.18)"
                        : "transparent",
                    color:
                      activeTab === tab
                        ? "hsl(217 91% 75%)"
                        : "hsl(0 0% 100% / 0.4)",
                  }}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-2 max-h-[520px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-white/40 text-center py-8">
                Loading clips…
              </p>
            ) : visibleClips.length === 0 ? (
              <p className="text-sm text-white/40 text-center py-8">
                No clips in this view.
              </p>
            ) : (
              visibleClips.map((clip) => {
                const isSelected = clip.id === selectedClipId;
                const labelColors = clip.label
                  ? LABEL_COLORS[clip.label]
                  : null;

                return (
                  <button
                    key={clip.id}
                    onClick={() => {
                      setSelectedClipId(isSelected ? null : clip.id);
                      setTagError(null);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors"
                    style={{
                      background: isSelected
                        ? "hsl(217 91% 60% / 0.08)"
                        : "hsl(225 25% 9%)",
                      borderColor: isSelected
                        ? "hsl(217 91% 60% / 0.3)"
                        : "hsl(0 0% 100% / 0.05)",
                    }}
                  >
                    {/* Thumbnail placeholder */}
                    <div
                      className="w-14 h-10 rounded-lg shrink-0 flex items-center justify-center text-white/20"
                      style={{ background: "hsl(225 25% 12%)" }}
                    >
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </div>

                    {/* Clip info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">
                        {clip.cameraName}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {formatDuration(clip.durationSeconds)} •{" "}
                        {new Date(clip.timestamp).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    {/* Label badge */}
                    {clip.tagged && clip.label && labelColors && (
                      <span
                        className="px-2 py-0.5 rounded-md text-xs font-semibold shrink-0 capitalize"
                        style={{
                          background: labelColors.bg,
                          color: labelColors.text,
                        }}
                      >
                        {clip.label.replace("_", " ")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </motion.div>

        {/* ── Right: tag panel ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <div
            className="px-5 py-4 border-b border-white/[0.06]"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <p className="text-sm font-medium text-white/70">Tag Selected Clip</p>
          </div>

          <div className="p-5">
            {!selectedClip ? (
              <p className="text-sm text-white/30 text-center py-12">
                Select a clip from the list to tag it.
              </p>
            ) : (
              <div className="space-y-5">
                {/* Selected clip info */}
                <div
                  className="rounded-xl border border-white/[0.06] px-4 py-3"
                  style={{ background: "hsl(225 25% 9%)" }}
                >
                  <p className="text-sm text-white/80 font-medium">
                    {selectedClip.cameraName}
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    {formatDuration(selectedClip.durationSeconds)} •{" "}
                    {new Date(selectedClip.timestamp).toLocaleString()}
                  </p>
                  {selectedClip.tagged && selectedClip.label && (
                    <p className="text-xs mt-2" style={{ color: "hsl(38 92% 65%)" }}>
                      Currently tagged as: {selectedClip.label.replace("_", " ")}
                    </p>
                  )}
                </div>

                {/* Label selector */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
                    Assign label
                  </label>
                  <select
                    value={pendingLabel}
                    onChange={(e) => {
                      setPendingLabel(e.target.value as VideoLabel);
                      setTagError(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] text-white/80 text-sm"
                    style={{ background: "hsl(225 25% 9%)" }}
                  >
                    {VALID_LABELS.map((lbl) => (
                      <option key={lbl} value={lbl}>
                        {lbl.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Error message */}
                {tagError && (
                  <p className="text-xs" style={{ color: "hsl(0 72% 65%)" }}>
                    {tagError}
                  </p>
                )}

                {/* Tag button */}
                <button
                  onClick={handleTagClip}
                  disabled={tagMutation.isPending}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "hsl(217 91% 60%)",
                    color: "hsl(225 25% 5%)",
                    boxShadow: "0 0 24px hsl(217 91% 60% / 0.3)",
                  }}
                >
                  {tagMutation.isPending ? "Saving…" : "Tag Clip"}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoTagging;
