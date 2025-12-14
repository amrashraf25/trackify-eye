import { Cigarette, Users, Swords, AlertCircle } from "lucide-react";

interface Incident {
  id: number;
  type: string;
  icon: React.ElementType;
  time: string;
  room: number;
}

const incidents: Incident[] = [
  { id: 1, type: "Smoking", icon: Cigarette, time: "2 min ago", room: 101 },
  { id: 2, type: "Aggression", icon: Users, time: "5 min ago", room: 203 },
  { id: 3, type: "Fight", icon: Swords, time: "8 min ago", room: 105 },
  { id: 4, type: "Suspicious", icon: AlertCircle, time: "12 min ago", room: 302 },
];

interface RealTimeFeedProps {
  searchQuery: string;
}

const RealTimeFeed = ({ searchQuery }: RealTimeFeedProps) => {
  const filteredIncidents = incidents.filter((incident) =>
    incident.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${incident.room}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span className="w-2 h-2 bg-primary rounded-full pulse-ring" />
        Real-time Feed
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIncidents.map((incident, index) => (
          <div
            key={incident.id}
            className="flex items-center gap-4 p-4 bg-card/50 rounded-lg border border-border hover:border-primary/30 transition-all duration-200 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="w-12 h-12 rounded-lg bg-incident-icon flex items-center justify-center">
              <incident.icon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{incident.type}</p>
              <p className="text-sm text-muted-foreground">
                Detected in Room {incident.room}
              </p>
            </div>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
              {incident.time}
            </span>
          </div>
        ))}
        
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
