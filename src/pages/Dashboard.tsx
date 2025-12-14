import MainLayout from "@/components/layout/MainLayout";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, TrendingUp } from "lucide-react";

const Dashboard = () => {
  return (
    <MainLayout title="Dashboard">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Active Courses"
          value={12}
          icon={BookOpen}
          trend={{ value: 8, isPositive: true }}
          color="primary"
        />
        <MetricCard
          title="Behavioral Alerts"
          value={23}
          icon={AlertTriangle}
          trend={{ value: 12, isPositive: false }}
          color="warning"
        />
        <MetricCard
          title="Total Students"
          value={456}
          icon={Users}
          trend={{ value: 5, isPositive: true }}
          color="info"
        />
        <MetricCard
          title="Avg. Attendance"
          value="87%"
          icon={TrendingUp}
          trend={{ value: 3, isPositive: true }}
          color="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AttendanceChart />
        <BehaviorPieChart />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCourses />
        <GradesComposition />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
