"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, SquareKanban, Brain, LayoutGrid, Bot } from "lucide-react";
import { cn } from "@clawe/ui/lib/utils";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Board", url: "/board", icon: SquareKanban },
  { title: "Intel", url: "/intelligence", icon: Brain },
  { title: "Projects", url: "/projects", icon: LayoutGrid },
  { title: "Agents", url: "/agents", icon: Bot },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around px-1 py-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.url === "/"
              ? pathname === "/"
              : pathname.startsWith(item.url);
          return (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.5 : 1.8}
              />
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
