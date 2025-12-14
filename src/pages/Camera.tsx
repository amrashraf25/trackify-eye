import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { Video, VideoOff, Users, Clock, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const cameras = [
  { id: 1, room: 101, status: "active", detected: 28, present: 26, lastActivity: "2 min ago" },
  { id: 2, room: 102, status: "active", detected: 32, present: 30, lastActivity: "1 min ago" },
  { id: 3, room: 103, status: "offline", detected: 0, present: 0, lastActivity: "2 hours ago" },
  { id: 4, room: 201, status: "active", detected: 45, present: 42, lastActivity: "Just now" },
  { id: 5, room: 202, status: "active", detected: 18, present: 18, lastActivity: "5 min ago" },
  { id: 6, room: 203, status: "offline", detected: 0, present: 0, lastActivity: "1 day ago" },
  { id: 7, room: 301, status: "active", detected: 35, present: 33, lastActivity: "3 min ago" },
  { id: 8, room: 302, status: "active", detected: 22, present: 20, lastActivity: "Just now" },
];

const Camera = () => {
  const [selectedCamera, setSelectedCamera] = useState(cameras[0]);

  return (
    <MainLayout title="Camera Records">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cameras.map((camera) => (
              <div
                key={camera.id}
                onClick={() => setSelectedCamera(camera)}
                className={`relative bg-card rounded-xl border overflow-hidden cursor-pointer transition-all ${
                  selectedCamera.id === camera.id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {/* Camera Preview Placeholder */}
                <div className="aspect-video bg-secondary flex items-center justify-center relative">
                  {camera.status === "active" ? (
                    <>
                      <Video className="w-12 h-12 text-muted-foreground" />
                      <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full pulse-ring" />
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-12 h-12 text-muted-foreground/50" />
                      <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                    </>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Room {camera.room}</span>
                    <Badge
                      variant={camera.status === "active" ? "default" : "secondary"}
                      className={camera.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}
                    >
                      {camera.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {camera.detected} faces • {camera.present} present
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Camera Details */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Room {selectedCamera.room}</h3>
              <Badge
                className={
                  selectedCamera.status === "active"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-red-500/10 text-red-500"
                }
              >
                {selectedCamera.status}
              </Badge>
            </div>

            <div className="aspect-video bg-secondary rounded-lg flex items-center justify-center mb-4">
              {selectedCamera.status === "active" ? (
                <Video className="w-16 h-16 text-muted-foreground" />
              ) : (
                <VideoOff className="w-16 h-16 text-muted-foreground/50" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Detected</span>
                </div>
                <p className="text-xl font-semibold text-foreground">{selectedCamera.detected}</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs">Present</span>
                </div>
                <p className="text-xl font-semibold text-emerald-500">{selectedCamera.present}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Last activity: {selectedCamera.lastActivity}</span>
            </div>

            <Button className="w-full mt-4" disabled={selectedCamera.status === "offline"}>
              View Full Recording
            </Button>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h4 className="font-semibold text-foreground mb-4">Recent Activity</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Face detected</span>
                <span className="text-foreground">2 min ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Motion detected</span>
                <span className="text-foreground">5 min ago</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Recording started</span>
                <span className="text-foreground">1 hour ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Camera;
