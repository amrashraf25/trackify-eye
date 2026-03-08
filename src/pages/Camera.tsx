import MainLayout from "@/components/layout/MainLayout";
import { useState, useRef, useCallback } from "react";
import { Video, VideoOff, Users, Clock, Eye, Camera as CameraIcon, Square, Scan } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PythonIntegrationCode from "@/components/PythonIntegrationCode";
import LiveIncidentFeed from "@/components/LiveIncidentFeed";
import { motion } from "framer-motion";

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
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const startLiveCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setIsLiveActive(true);
      toast({ title: "Live Camera Started", description: "Camera feed is now active." });
    } catch (error) {
      toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" });
    }
  }, [toast]);

  const stopLiveCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setIsLiveActive(false);
    toast({ title: "Live Camera Stopped", description: "Camera feed has been stopped." });
  }, [stream, toast]);

  return (
    <MainLayout title="Camera Records">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cameras.map((camera, index) => (
              <motion.div
                key={camera.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedCamera(camera)}
                className={`relative glass rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover-lift ${
                  selectedCamera.id === camera.id
                    ? "ring-2 ring-primary shadow-glow-primary"
                    : "hover:ring-1 hover:ring-primary/30"
                }`}
              >
                <div className="aspect-video bg-secondary/50 flex items-center justify-center relative">
                  {camera.status === "active" ? (
                    <>
                      <Video className="w-10 h-10 text-muted-foreground/50" />
                      <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full pulse-ring" />
                      {/* Scan line effect */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent animate-scan-line" />
                      </div>
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-10 h-10 text-muted-foreground/30" />
                      <div className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
                    </>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-sm">Room {camera.room}</span>
                    <Badge
                      variant={camera.status === "active" ? "default" : "secondary"}
                      className={`text-[10px] ${camera.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}`}
                    >
                      {camera.status}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {camera.detected} faces • {camera.present} present
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Camera Details */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">Room {selectedCamera.room}</h3>
              <Badge className={selectedCamera.status === "active" ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"}>
                {selectedCamera.status}
              </Badge>
            </div>

            <div className="aspect-video bg-secondary/50 rounded-xl flex items-center justify-center mb-4 overflow-hidden relative">
              {isLiveActive ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex items-center gap-2 bg-destructive text-primary-foreground px-2 py-1 rounded-lg text-xs font-bold">
                    <span className="w-2 h-2 bg-primary-foreground rounded-full animate-pulse" />
                    LIVE
                  </div>
                  {/* AI overlay */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] text-neon-cyan font-mono">
                    <Scan className="w-3 h-3" />
                    AI Processing
                  </div>
                </>
              ) : selectedCamera.status === "active" ? (
                <div className="text-center">
                  <Video className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Click to start live feed</p>
                </div>
              ) : (
                <VideoOff className="w-12 h-12 text-muted-foreground/30" />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary/30 rounded-xl p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Detected</span>
                </div>
                <p className="text-xl font-bold text-foreground">{selectedCamera.detected}</p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Present</span>
                </div>
                <p className="text-xl font-bold text-emerald-500">{selectedCamera.present}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>Last activity: {selectedCamera.lastActivity}</span>
            </div>

            <div className="flex gap-2 mt-4">
              {!isLiveActive ? (
                <Button className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90" onClick={startLiveCamera} disabled={selectedCamera.status === "offline"}>
                  <CameraIcon className="w-4 h-4 mr-2" />Start Live Feed
                </Button>
              ) : (
                <Button className="flex-1 rounded-xl" variant="destructive" onClick={stopLiveCamera}>
                  <Square className="w-4 h-4 mr-2" />Stop Live Feed
                </Button>
              )}
            </div>

            <Button className="w-full mt-2 rounded-xl" variant="outline" disabled={selectedCamera.status === "offline"}>
              View Full Recording
            </Button>
          </motion.div>

          <PythonIntegrationCode />
          <LiveIncidentFeed />
        </div>
      </div>
    </MainLayout>
  );
};

export default Camera;
