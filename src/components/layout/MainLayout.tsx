import { ReactNode } from "react";
import Sidebar from "../Sidebar";
import Header from "../Header";
import AnimatedBackground from "../AnimatedBackground";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

const MainLayout = ({ children, title }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-background relative">
      <AnimatedBackground />
      <Sidebar />
      <div className="flex-1 flex flex-col relative z-10">
        <Header title={title} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
