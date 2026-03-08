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

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full pulse-ring" />
          Real-time Feed
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 glass rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-neon-cyan rounded-full pulse-ring" />
        Real-time Feed
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredIncidents.map((incident, index) => {
          const Icon = getIncidentIcon(incident.incident_type);
          const timeAgo = formatDistanceToNow(new Date(incident.detected_at), { addSuffix: true });
          
          return (
            <motion.div
              key={incident.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 p-4 glass rounded-xl hover:shadow-card-hover transition-all duration-200 group cursor-default"
            >
              <div className="w-11 h-11 rounded-xl bg-incident-icon flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">{incident.incident_type}</p>
                <p className="text-xs text-muted-foreground">Room {incident.room_number}</p>
              </div>
              <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg shrink-0">
                {timeAgo}
              </span>
            </motion.div>
          );
        })}
        
        {filteredIncidents.length === 0 && (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            No incidents found matching your search.
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeFeed;
