import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface IncidentRecord {
  id: string;
  incident_type: string;
  student_name?: string;
  room_number: string;
  detected_at: string;
  video_clip_url?: string | null;
  severity: string;
  status: string;
  description?: string;
}

interface IncidentTableProps {
  searchQuery: string;
}

const IncidentTable = ({ searchQuery }: IncidentTableProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["incidents-table"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data as IncidentRecord[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("incidents-table")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["incidents-table"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredRecords = records.filter((record) =>
    record.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${record.room_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SEV_STYLE: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border border-red-500/30",
    high:     "bg-orange-500/15 text-orange-400 border border-orange-500/30",
    medium:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    low:      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  };

  if (isLoading) {
    return <div className="h-64 glass rounded-xl animate-pulse" />;
  }

  return (
    <div className="overflow-hidden rounded-xl glass">
      <table className="w-full">
        <thead>
          <tr className="bg-table-header/50">
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Severity</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Incident Type</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Student</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Room</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detected</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider"></th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((record, index) => (
            <motion.tr
              key={record.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className="border-t border-border/30 hover:bg-table-hover/50 transition-colors duration-150"
            >
              <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize ${SEV_STYLE[record.severity] ?? SEV_STYLE.medium}`}>
                  {record.severity === "critical" ? <ShieldAlert className="w-3 h-3" /> : record.severity === "low" ? <ShieldCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                  {record.severity}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary capitalize">
                  {record.incident_type?.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-foreground/80">{record.student_name ?? "—"}</td>
              <td className="px-4 py-3 text-sm text-foreground">{record.room_number ? `Room ${record.room_number}` : "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                {format(new Date(record.detected_at), "MMM dd, HH:mm")}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-semibold capitalize ${
                  record.status === "resolved"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : record.status === "reviewing"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {record.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => navigate(`/incident/${record.id}`)}
                  className="text-xs rounded-lg hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all">
                  View
                </Button>
              </td>
            </motion.tr>
          ))}

          {filteredRecords.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No incidents found{searchQuery ? " matching your search" : ""}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default IncidentTable;
