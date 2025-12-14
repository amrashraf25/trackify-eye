import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import SearchBar from "@/components/SearchBar";
import RealTimeFeed from "@/components/RealTimeFeed";
import IncidentTable from "@/components/IncidentTable";

const Alerts = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <MainLayout title="Alerts">
      <div className="bg-alert-card rounded-2xl border border-alert-border p-6">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <RealTimeFeed searchQuery={searchQuery} />
        <IncidentTable searchQuery={searchQuery} />
      </div>
    </MainLayout>
  );
};

export default Alerts;
