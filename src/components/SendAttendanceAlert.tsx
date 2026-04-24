import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";

interface SendAttendanceAlertProps {
  studentId: string;
  studentName: string;
  absentCount?: number;
  courseName?: string;
}

const SendAttendanceAlert = ({ studentId, studentName, absentCount, courseName }: SendAttendanceAlertProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const defaultMessage = `You have ${absentCount ?? "multiple"} absence(s)${courseName ? ` in ${courseName}` : ""}. Please ensure regular attendance to avoid academic penalties.`;

  const sendAlert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").insert({
        student_id: studentId,
        sent_by: user?.id!,
        title: "⚠️ Attendance Warning",
        message: message || defaultMessage,
        type: "attendance_warning",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Attendance alert sent to ${studentName}`);
      setOpen(false);
      setMessage("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
          <AlertTriangle className="w-3.5 h-3.5" />
          Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Send Attendance Alert to {studentName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {(absentCount !== undefined || courseName) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-sm text-foreground">
                {courseName && <span>Course: <strong>{courseName}</strong> • </span>}
                {absentCount !== undefined && <span>Absences: <strong className="text-amber-600">{absentCount}</strong></span>}
              </p>
            </div>
          )}
          <div>
            <Label>Message</Label>
            <Textarea
              placeholder={defaultMessage}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[100px] bg-secondary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave empty to use default message</p>
          </div>
          <Button onClick={() => sendAlert.mutate()} disabled={sendAlert.isPending} className="w-full gap-2">
            <Send className="w-4 h-4" />
            {sendAlert.isPending ? "Sending..." : "Send Alert"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendAttendanceAlert;
