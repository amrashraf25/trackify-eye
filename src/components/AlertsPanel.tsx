import { useState } from "react";
import SearchBar from "./SearchBar";
import RealTimeFeed from "./RealTimeFeed";
import IncidentTable from "./IncidentTable";

const AlertsPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Search */}
      <div className="mb-6">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Alert Card */}
      <div className="bg-alert-card border border-alert-border rounded-xl p-6 shadow-glow-subtle">
        <RealTimeFeed searchQuery={searchQuery} />
        <IncidentTable searchQuery={searchQuery} />
      </div>
    </div>
  );
};

export default AlertsPanel;
