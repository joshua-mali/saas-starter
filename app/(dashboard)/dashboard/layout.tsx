"use client";

import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ClipboardCheck,
  HomeIcon,
  LayoutPanelLeft,
  Menu,
  Settings,
  StickyNote,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", icon: HomeIcon, label: "Home" },
    { href: "/dashboard/classes", icon: BookOpen, label: "Classes" },
    { href: "/dashboard/planning", icon: LayoutPanelLeft, label: "Planning" },
    { href: "/dashboard/grading", icon: ClipboardCheck, label: "Grading" },
    { href: "/dashboard/students", icon: UsersRound, label: "Students" },
    { href: "/dashboard/notes", icon: StickyNote, label: "Notes" },
    { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex flex-col h-[calc(100dvh-68px)] w-full">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-gray-200 p-4">
        <div className="flex items-center">
          <span className="font-medium">
            {navItems.find(
              (item) =>
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href))
            )?.label ?? "Dashboard"}
          </span>
        </div>
        <Button
          className="-mr-3"
          variant="ghost"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-64 bg-white lg:bg-gray-50 border-r border-gray-200 lg:block ${
            isSidebarOpen ? "block" : "hidden"
          } lg:relative absolute inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="h-full overflow-y-auto p-4">
            {navItems.map((item) => {
              const currentClassId = searchParams.get("classId");
              const href = currentClassId
                ? `${item.href}?classId=${currentClassId}`
                : item.href;

              return (
                <Link key={item.href} href={href} passHref>
                  <Button
                    variant={
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href))
                        ? "secondary"
                        : "ghost"
                    }
                    className={`shadow-none my-1 w-full justify-start ${
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href))
                        ? "bg-gray-100"
                        : ""
                    }`}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 h-full overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
