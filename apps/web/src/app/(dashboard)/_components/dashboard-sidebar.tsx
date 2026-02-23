"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, SquareKanban, Bot, Brain, LayoutGrid, Settings, Timer, Database, GraduationCap, BarChart2, Puzzle, ShieldCheck, MonitorDot, GitMerge, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { NavMain, type NavItem } from "./nav-main";
import { NavSettings } from "./nav-settings";
import { NavUser } from "./nav-user";
import { SquadSwitcher } from "./squad-switcher";
import { SidebarNavProvider, useSidebarNav } from "./sidebar-nav-provider";
import { isLockedSidebarRoute } from "./sidebar-config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@clawe/ui/components/sidebar";
import { useProjects, useCrons } from "@/lib/api/local";

const slideVariants = {
  enterFromRight: { x: "100%", opacity: 0 },
  enterFromLeft: { x: "-100%", opacity: 0 },
  center: { x: 0, opacity: 1 },
  exitToLeft: { x: "-100%", opacity: 0 },
  exitToRight: { x: "100%", opacity: 0 },
};

const SidebarNavContent = () => {
  const router = useRouter();
  const { view, goToSettings } = useSidebarNav();
  const { data: projectsData } = useProjects();
  const { data: cronsData } = useCrons();

  const handleSettingsClick = () => {
    goToSettings();
    router.push("/settings");
  };

  // Count running projects
  const runningCount = React.useMemo(() => {
    if (!projectsData?.projects) return 0;
    return projectsData.projects.filter((p) => p.running).length;
  }, [projectsData]);

  // Count cron errors
  const cronErrorCount = React.useMemo(() => {
    if (!cronsData?.crons) return 0;
    return cronsData.crons.filter((c) => c.status === "error").length;
  }, [cronsData]);

  const navItems: NavItem[] = [
    {
      title: "Home",
      url: "/agents",
      icon: Home,
    },
    {
      title: "Board",
      url: "/board",
      icon: SquareKanban,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: Bot,
    },
    {
      title: "Coordination",
      url: "/coordination",
      icon: GitMerge,
    },
    {
      title: "Intelligence",
      url: "/intelligence",
      icon: Brain,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: LayoutGrid,
      badge: runningCount > 0 ? String(runningCount) : undefined,
    },
    {
      title: "Crons",
      url: "/crons",
      icon: Timer,
    },
    {
      title: "Memory",
      url: "/memory",
      icon: Database,
    },
    {
      title: "Skills",
      url: "/skills",
      icon: Puzzle,
    },
    {
      title: "Sessions",
      url: "/sessions",
      icon: MonitorDot,
    },
    {
      title: "Fleet Health",
      url: "/fleet",
      icon: ShieldCheck,
    },
    {
      title: "DBA Papers",
      url: "/dba",
      icon: GraduationCap,
    },
    {
      title: "Weekly Review",
      url: "/weekly-review",
      icon: BarChart2,
      title: "Watchlist",
      url: "/repos",
      icon: BookOpen,
    },
    {
      title: "Crons",
      url: "/crons",
      icon: Timer,
      badge: cronErrorCount > 0 ? String(cronErrorCount) : undefined,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      onClick: handleSettingsClick,
    },
  ];

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        {view === "main" ? (
          <motion.div
            key="main"
            initial="enterFromLeft"
            animate="center"
            exit="exitToLeft"
            variants={slideVariants}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="flex flex-1 flex-col"
          >
            <NavMain items={navItems} />
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial="enterFromRight"
            animate="center"
            exit="exitToRight"
            variants={slideVariants}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="flex flex-1 flex-col"
          >
            <NavSettings />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DashboardSidebar = ({
  ...props
}: React.ComponentProps<typeof Sidebar>) => {
  const pathname = usePathname();
  const hideRail = isLockedSidebarRoute(pathname);

  return (
    <SidebarNavProvider>
      <Sidebar collapsible="icon" variant="inset" {...props}>
        <SidebarHeader className="h-12 justify-center group-data-[collapsible=icon]:px-0">
          <SquadSwitcher />
        </SidebarHeader>
        <SidebarContent className="overflow-hidden">
          <SidebarNavContent />
        </SidebarContent>
        <SidebarFooter className="justify-center group-data-[collapsible=icon]:px-0">
          <NavUser />
        </SidebarFooter>
        {!hideRail && <SidebarRail />}
      </Sidebar>
    </SidebarNavProvider>
  );
};
