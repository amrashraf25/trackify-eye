import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, AlertTriangle, MapPin, Clock, Info } from "lucide-react";
import { format } from "date-fns";

const IncidentDetail = () => {
  const { id } = useParams<{ id: string }>();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <MainLayout title="Incident Detail">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading incident...</div>
        </div>
      </MainLayout>
    );
  }

  if (!incident) {
    return (
      <MainLayout title="Incident Detail">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Incident not found</p>
          <Link to="/alerts">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Alerts
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Incident Detail">
      <div className="space-y-6">
        {/* Back Button */}
        <Link to="/alerts">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Alerts
          </Button>
        </Link>

        {/* Incident Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Play className="w-5 h-5 text-primary" />
                Incident Recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center border border-border">
                {incident.video_clip_url ? (
                  <video 
                    controls 
                    className="w-full h-full rounded-lg"
                    src={incident.video_clip_url}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <Play className="w-16 h-16" />
                    <p>Video clip: clip_{incident.id.slice(0, 6)}.mp4</p>
                    <p className="text-sm">Video playback placeholder</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Details Panel */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Info className="w-5 h-5 text-primary" />
                Incident Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <AlertTriangle className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Incident Type</p>
                  <p className="font-medium text-foreground">{incident.incident_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium text-foreground">Room {incident.room_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Detected At</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(incident.detected_at), "PPpp")}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Severity</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  incident.severity === "high" 
                    ? "bg-primary/20 text-primary" 
                    : incident.severity === "medium"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-green-500/20 text-green-400"
                }`}>
                  {incident.severity}
                </span>
              </div>

              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  incident.status === "resolved" 
                    ? "bg-green-500/20 text-green-400" 
                    : incident.status === "reviewing"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-primary/20 text-primary"
                }`}>
                  {incident.status}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default IncidentDetail;
