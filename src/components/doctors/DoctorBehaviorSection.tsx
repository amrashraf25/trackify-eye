import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface DoctorBehaviorSectionProps {
  doctorId: string;
  doctorName: string;
  userId?: string;
}

const DoctorBehaviorSection = ({ doctorId, doctorName, userId }: DoctorBehaviorSectionProps) => {
  const [open, setOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [action, setAction] = useState({ action_name: "", action_type: "negative", score_change: "-5", notes: "", week_number: "1" });
  const queryClient = useQueryClient();

  const { data: score } = useQuery({
    queryKey: ["doctor-behavior-score", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_behavior_scores")
        .select("score")
        .eq("doctor_id", doctorId)
        .maybeSingle();
      if (error) return 100;
      return data?.score ?? 100;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["doctor-behavior-records", doctorId, selectedWeek],
    queryFn: async () => {
      let query = supabase
        .from("doctor_behavior_records")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("created_at", { ascending: false });
      if (selectedWeek !== null) {
        query = query.eq("week_number", selectedWeek);
      }
      const { data, error } = await query.limit(20);
      if (error) return [];
      return data;
    },
  });

  const weeklyScore = selectedWeek !== null && records.length > 0
    ? Math.max(0, Math.min(100, 100 + records.reduce((sum: number, r: any) => sum + r.score_change, 0)))
    : null;

  const addRecord = useMutation({
    mutationFn: async () => {
      if (!action.action_name) throw new Error("Action is required");
      const scoreChange = parseInt(action.score_change);
      if (isNaN(scoreChange)) throw new Error("Invalid score");

      const { error } = await supabase.from("doctor_behavior_records").insert({
        doctor_id: doctorId,
        recorded_by: userId!,
        action_name: action.action_name,
        action_type: action.action_type,
        score_change: scoreChange,
        notes: action.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-behavior-score", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["doctor-behavior-records", doctorId] });
      toast.success("Behavior record added");
      setOpen(false);
      setAction({ action_name: "", action_type: "negative", score_change: "-5", notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const behaviorScore = score ?? 100;
  const scoreColor = behaviorScore >= 80 ? "text-emerald-500" : behaviorScore >= 60 ? "text-amber-500" : "text-destructive";
  const progressColor = behaviorScore >= 80 ? "bg-emerald-500" : behaviorScore >= 60 ? "bg-amber-500" : "bg-destructive";

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          Behavior Score
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="w-4 h-4 mr-1" /> Record
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader><DialogTitle>Record Behavior — {doctorName}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Action</Label>
                <Input value={action.action_name}
                  onChange={(e) => setAction({ ...action, action_name: e.target.value })}
                  placeholder="e.g. Late to class, Excellent teaching..."
                  className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={action.action_type}
                    onValueChange={(v) => setAction({ ...action, action_type: v, score_change: v === "positive" ? "5" : "-5" })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Score Change</Label>
                  <Input type="number" value={action.score_change}
                    onChange={(e) => setAction({ ...action, score_change: e.target.value })}
                    className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea value={action.notes}
                  onChange={(e) => setAction({ ...action, notes: e.target.value })}
                  placeholder="Additional notes..."
                  className="rounded-xl" />
              </div>
              <Button onClick={() => addRecord.mutate()} className="w-full rounded-xl">Submit</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Score display */}
      <div className="flex items-center gap-4 mb-5 p-4 bg-secondary/30 rounded-xl">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall Score</p>
          <div className="flex items-center gap-3">
            <div className="relative h-2 flex-1 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${behaviorScore}%` }} />
            </div>
            <span className={`text-xl font-bold ${scoreColor}`}>{behaviorScore}%</span>
          </div>
        </div>
      </div>

      {/* History */}
      {records.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {records.map((record: any) => (
            <div key={record.id} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-xl hover:bg-secondary/40 transition-colors">
              {record.action_type === "positive" ? (
                <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{record.action_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {record.score_change > 0 ? "+" : ""}{record.score_change}% • {format(new Date(record.created_at), "MMM dd, yyyy")}
                </p>
                {record.notes && <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No behavior records yet</p>
      )}
    </motion.div>
  );
};

export default DoctorBehaviorSection;
