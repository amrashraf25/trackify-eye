import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Phone, Moon, MessageCircle, Coffee, Utensils, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

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
    case "high": return "bg-destructive/10 text-destructive";
    case "medium": return "bg-amber-500/10 text-amber-500";
    case "low": return "bg-neon-blue/10 text-neon-blue";
    default: return "bg-muted text-muted-foreground";
  }
};

const LiveIncidentFeed = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      if (data) setIncidents(data);
    };
    fetchRecent();

    const channel = supabase
      .channel("live-incidents")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incidents" }, (payload) => {
        setIncidents((prev) => [payload.new as Incident, ...prev].slice(0, 20));
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-foreground text-sm">Live Detection Feed</h4>
        <div className="flex items-center gap-2">
          <Wifi className={`w-3.5 h-3.5 ${isConnected ? "text-neon-cyan" : "text-muted-foreground"}`} />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
        </div>
      </div>

      {incidents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No incidents yet. Run the Python script to start detecting.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <AnimatePresence>
            {incidents.map((incident) => (
              <motion.div
                key={incident.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 hover:bg-secondary/40 transition-colors"
              >
                <div className={`p-1.5 rounded-lg ${getSeverityColor(incident.severity)}`}>
                  {getBehaviorIcon(incident.incident_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{incident.incident_type}</p>
                  <p className="text-[10px] text-muted-foreground">Room {incident.room_number}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className={`text-[10px] ${getSeverityColor(incident.severity)}`}>
                    {incident.severity}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(incident.detected_at), { addSuffix: true })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default LiveIncidentFeed;
