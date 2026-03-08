import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import SearchBar from "@/components/SearchBar";
import RealTimeFeed from "@/components/RealTimeFeed";
import IncidentTable from "@/components/IncidentTable";

const Alerts = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <MainLayout title="Alerts">
      <div className="glass rounded-2xl p-6 neon-border">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <div className="mt-6">
          <RealTimeFeed searchQuery={searchQuery} />
        </div>
        <IncidentTable searchQuery={searchQuery} />
      </div>
    </MainLayout>
  );
};

export default Alerts;
