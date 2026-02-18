import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Phone, Moon, MessageCircle, Coffee, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Incident {
  id: string;
  incident_type: string;
  room_number: string;
  severity: string | null;
  status: string | null;
  detected_at: string;
}

const getBehaviorIcon = (type: string) => {
  const lower = type.toLowerCase();
  if (lower.includes("phone")) return <Phone className="w-4 h-4" />;
  if (lower.includes("sleep")) return <Moon className="w-4 h-4" />;
  if (lower.includes("talk")) return <MessageCircle className="w-4 h-4" />;
  if (lower.includes("drink")) return <Coffee className="w-4 h-4" />;
  if (lower.includes("eat")) return <Utensils className="w-4 h-4" />;
  return <AlertTriangle className="w-4 h-4" />;
};

const getSeverityColor = (severity: string | null) => {
  switch (severity) {
    case "high": return "bg-red-500/10 text-red-500";
    case "medium": return "bg-amber-500/10 text-amber-500";
    case "low": return "bg-blue-500/10 text-blue-500";
    default: return "bg-muted text-muted-foreground";
  }
};

const LiveIncidentFeed = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Fetch recent incidents
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      if (data) setIncidents(data);
    };
    fetchRecent();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("live-incidents")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incidents" },
        (payload) => {
          setIncidents((prev) => [payload.new as Incident, ...prev].slice(0, 20));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-foreground">Live Detection Feed</h4>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{isConnected ? "Connected" : "Connecting..."}</span>
        </div>
      </div>

      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No incidents yet. Run the Python script to start detecting.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className={`p-1.5 rounded-md ${getSeverityColor(incident.severity)}`}>
                {getBehaviorIcon(incident.incident_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{incident.incident_type}</p>
                <p className="text-xs text-muted-foreground">Room {incident.room_number}</p>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                  {incident.severity}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(incident.detected_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveIncidentFeed;
