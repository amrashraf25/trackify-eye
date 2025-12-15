import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Play } from "lucide-react";
import { format } from "date-fns";

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

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("incidents-table")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incidents-table"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredRecords = records.filter((record) =>
    record.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${record.room_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Data</h2>
        <div className="h-64 bg-card/50 rounded-lg border border-border animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">Data</h2>
      
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="bg-table-header">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Video Clip</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Incident Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Room Number</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record, index) => (
              <tr 
                key={record.id} 
                className="border-t border-border hover:bg-table-hover transition-colors duration-150 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      {record.video_clip_url || `clip_${record.id.slice(0, 6)}.mp4`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                    {record.incident_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">Room {record.room_number}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {format(new Date(record.detected_at), "yyyy-MM-dd HH:mm")}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    record.status === "resolved" 
                      ? "bg-green-500/20 text-green-400" 
                      : record.status === "reviewing"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-primary/20 text-primary"
                  }`}>
                    {record.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button variant="view" size="sm">
                    View
                  </Button>
                </td>
              </tr>
            ))}
            
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
