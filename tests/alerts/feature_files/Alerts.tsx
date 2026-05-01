import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import SearchBar from "@/components/SearchBar";
import RealTimeFeed from "@/components/RealTimeFeed";
import IncidentTable from "@/components/IncidentTable";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, Activity, ShieldAlert, Filter } from "lucide-react";

// Displays live behavior alerts: a real-time incident feed and a searchable incident log table.
const Alerts = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const SEV_CHIPS: { id: string; label: string; cls: string }[] = [
    { id: "all",      label: "All",      cls: "bg-secondary/60 text-foreground border-border/50" },
    { id: "critical", label: "Critical", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    { id: "high",     label: "High",     cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    { id: "medium",   label: "Medium",   cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
    { id: "low",      label: "Low",      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
  ];

  return (
    <MainLayout title="Alerts">
      <div className="space-y-6">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-destructive/15 via-amber-500/10 to-orange-500/10 border border-destructive/20 p-6"
        >
          <div className="absolute top-0 right-0 w-56 h-56 bg-destructive/10 rounded-full blur-[80px] -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 border border-destructive/25 flex items-center justify-center shadow-lg shadow-destructive/10">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest text-destructive/80">Live Monitoring</span>
                <span className="flex items-center gap-1 text-[10px] bg-destructive/10 border border-destructive/20 text-destructive px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />Active
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground">Behavior Alerts</h1>
              <p className="text-sm text-muted-foreground">Real-time incident feed and behavior notifications</p>
            </div>
            <div className="flex items-center gap-4 text-center">
              <div>
                <Activity className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Feed</p>
              </div>
              <div>
                <Bell className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Alerts</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search + Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 border border-border/50"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              {SEV_CHIPS.map((chip) => {
                const active = severityFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setSeverityFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide border transition-all ${chip.cls} ${active ? "ring-2 ring-offset-2 ring-offset-background ring-primary/40 scale-105" : "opacity-70 hover:opacity-100"}`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Real-time Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl border border-border/50 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Live Feed</h3>
            <span className="ml-auto text-[10px] text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              Auto-updating
            </span>
          </div>
          <div className="p-5">
            <RealTimeFeed searchQuery={searchQuery} />
          </div>
        </motion.div>

        {/* Incident Table */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl border border-border/50 overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">Incident Log</h3>
          </div>
          <div className="p-5">
            <IncidentTable searchQuery={searchQuery} severityFilter={severityFilter} />
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default Alerts;
