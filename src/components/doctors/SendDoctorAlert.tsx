// Button + dialog that lets the dean send a behavior-score warning notification to a specific doctor.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";

interface SendDoctorAlertProps {
  doctorId: string;
  doctorName: string;
  score: number;
}

const SendDoctorAlert = ({ doctorId, doctorName, score }: SendDoctorAlertProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  // Pre-fill the textarea with a sensible default; the sender can override it
  const defaultMessage = `Your behavior score is currently at ${score}%. This is below the acceptable threshold. Please improve your conduct to avoid further consequences.`;

  // Insert a notification record into doctor_notifications to trigger a real-time alert for the doctor
  const sendAlert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("doctor_notifications" as any).insert({
        doctor_id: doctorId,
        sent_by: user?.id!,
        title: "⚠️ Low Behavior Score Warning",
        message: message || defaultMessage,
        type: "behavior_warning",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Alert sent to ${doctorName}`);
      setOpen(false);
      setMessage("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive" className="gap-1.5 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" />
          Send Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Send Alert to {doctorName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3">
            <p className="text-sm text-foreground">
              Current Score: <span className="font-bold text-destructive">{score}%</span>
            </p>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              placeholder={defaultMessage}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 min-h-[100px] bg-secondary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave empty to use default warning message</p>
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

export default SendDoctorAlert;
