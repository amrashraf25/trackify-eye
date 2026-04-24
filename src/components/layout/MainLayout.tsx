// Root layout wrapper used by all authenticated pages: renders the sidebar, header, animated background, and the page content.
import { ReactNode } from "react";
import Sidebar from "../Sidebar";
import Header from "../Header";
import AnimatedBackground from "../AnimatedBackground";
import { motion } from "framer-motion";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
}

// Composes the full-page shell; the `key={title}` on <main> triggers a fade-in animation on each page change
const MainLayout = ({ children, title }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-background relative">
      <AnimatedBackground />
      <Sidebar />
      <div className="flex-1 flex flex-col relative z-10">
        <Header title={title} />
        <motion.main
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex-1 p-6 overflow-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};

export default MainLayout;
