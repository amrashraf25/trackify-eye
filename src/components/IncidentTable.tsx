import { Button } from "./ui/button";
import { Play } from "lucide-react";

interface IncidentRecord {
  id: number;
  videoClip: string;
  incidentType: string;
  roomNumber: number;
  date: string;
}

const incidentRecords: IncidentRecord[] = [
  { id: 1, videoClip: "clip_001.mp4", incidentType: "Smoking", roomNumber: 101, date: "2024-12-14 09:23" },
  { id: 2, videoClip: "clip_002.mp4", incidentType: "Aggression", roomNumber: 203, date: "2024-12-14 09:18" },
  { id: 3, videoClip: "clip_003.mp4", incidentType: "Fight", roomNumber: 105, date: "2024-12-14 09:10" },
  { id: 4, videoClip: "clip_004.mp4", incidentType: "Suspicious", roomNumber: 302, date: "2024-12-14 08:55" },
  { id: 5, videoClip: "clip_005.mp4", incidentType: "Smoking", roomNumber: 401, date: "2024-12-14 08:42" },
];

interface IncidentTableProps {
  searchQuery: string;
}

const IncidentTable = ({ searchQuery }: IncidentTableProps) => {
  const filteredRecords = incidentRecords.filter((record) =>
    record.incidentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.videoClip.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `room ${record.roomNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    <span className="text-sm text-foreground">{record.videoClip}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                    {record.incidentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">Room {record.roomNumber}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{record.date}</td>
                <td className="px-4 py-3">
                  <Button variant="view" size="sm">
                    View
                  </Button>
                </td>
              </tr>
            ))}
            
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
