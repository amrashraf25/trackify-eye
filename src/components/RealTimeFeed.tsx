import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cigarette, Users, Swords, AlertCircle, Flame, Smartphone, Moon, MessageCircle, Coffee, Utensils } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

interface Incident {
  id: string;
  incident_type: string;
  room_number: string;
  detected_at: string;
  severity: string;
}

const getIncidentIcon = (type: string) => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes("smoking")) return Cigarette;
  if (lowerType.includes("fight")) return Swords;
  if (lowerType.includes("aggression")) return Users;
  if (lowerType.includes("fire")) return Flame;
  if (lowerType.includes("phone")) return Smartphone;
  if (lowerType.includes("sleeping")) return Moon;
  if (lowerType.includes("talking")) return MessageCircle;
  if (lowerType.includes("drinking")) return Coffee;
  if (lowerType.includes("eating")) return Utensils;
  return AlertCircle;
};

interface RealTimeFeedProps {
  searchQuery: string;
}

const RealTimeFeed = ({ searchQuery }: RealTimeFeedProps) => {
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents-realtime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Incident[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("realtime-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => {
        queryClient.invalidateQueries({ queryKey: ["incidents-realtime"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredIncidents = incidents.filter((incident) =>
    incident.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${incident.room_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SEV_COLOR: Record<string, { icon: string; bg: string; border: string }> = {
    critical: { icon: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    high:     { icon: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    medium:   { icon: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
    low:      { icon: "text-emerald-400",bg: "bg-emerald-500/8", border: "border-emerald-500/15" },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 glass rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {filteredIncidents.map((incident, index) => {
        const Icon = getIncidentIcon(incident.incident_type);
        const timeAgo = formatDistanceToNow(new Date(incident.detected_at), { addSuffix: true });
        const sev = SEV_COLOR[incident.severity] ?? SEV_COLOR.medium;

        return (
          <motion.div
            key={incident.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition-all duration-200 cursor-default hover:brightness-110 ${sev.bg} ${sev.border}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-black/20`}>
              <Icon className={`w-5 h-5 ${sev.icon}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm capitalize">{incident.incident_type?.replace(/_/g, " ")}</p>
              <p className="text-[11px] text-muted-foreground">{incident.room_number ? `Room ${incident.room_number}` : "Unknown room"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${sev.bg} ${sev.icon}`}>{incident.severity}</span>
              <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono">{timeAgo}</p>
            </div>
          </motion.div>
        );
      })}

      {filteredIncidents.length === 0 && (
        <div className="col-span-2 text-center py-10 text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No incidents{searchQuery ? " matching your search" : " recorded yet"}</p>
        </div>
      )}
    </div>
  );
};

export default RealTimeFeed;
