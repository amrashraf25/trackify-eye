import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import AlertsPanel from "@/components/AlertsPanel";

const Index = () => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <Header />
        <AlertsPanel />
      </div>
    </div>
  );
};

export default Index;
