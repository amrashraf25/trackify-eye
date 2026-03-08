import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Play } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface IncidentRecord {
  id: string;
  incident_type: string;
  room_number: string;
  detected_at: string;
  video_clip_url: string | null;
  severity: string;
  status: string;
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

  if (isLoading) {
    return (
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Data</h2>
        <div className="h-64 glass rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-base font-bold text-foreground mb-4">Data</h2>
      
      <div className="overflow-hidden rounded-xl glass">
        <table className="w-full">
          <thead>
            <tr className="bg-table-header/50">
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Video Clip</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Incident Type</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Room</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
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
                  <div className="flex items-center gap-2">
                    <Play className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-foreground font-mono">
                      {record.video_clip_url || `clip_${record.id.slice(0, 6)}.mp4`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary neon-border">
                    {record.incident_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">Room {record.room_number}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {format(new Date(record.detected_at), "yyyy-MM-dd HH:mm")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold ${
                    record.status === "resolved" 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : record.status === "reviewing"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-primary/10 text-primary"
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
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No records found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IncidentTable;
