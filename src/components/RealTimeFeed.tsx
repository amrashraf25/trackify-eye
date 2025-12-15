import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cigarette, Users, Swords, AlertCircle, Flame } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("realtime-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incidents-realtime"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredIncidents = incidents.filter((incident) =>
    incident.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${incident.room_number}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full pulse-ring" />
          Real-time Feed
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-card/50 rounded-lg border border-border animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-primary rounded-full pulse-ring" />
        Real-time Feed
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIncidents.map((incident, index) => {
          const Icon = getIncidentIcon(incident.incident_type);
          const timeAgo = formatDistanceToNow(new Date(incident.detected_at), { addSuffix: true });
          
          return (
            <div
              key={incident.id}
              className="flex items-center gap-4 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/30 transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-lg bg-incident-icon flex items-center justify-center">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{incident.incident_type}</p>
                <p className="text-sm text-muted-foreground">
                  Detected in Room {incident.room_number}
                </p>
              </div>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                {timeAgo}
              </span>
            </div>
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
