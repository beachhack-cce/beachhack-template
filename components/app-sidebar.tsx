"use client"

import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconListDetails,
  IconReport,
  IconUsers,
  IconServer,
  IconShieldExclamation,
  IconSearch
} from "@tabler/icons-react"
import { Rocket } from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"

const routes = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard/overview",
      icon: IconDashboard,
    },

    {
      title: "Alerts",
      url: "/dashboard/alerts",
      icon: IconShieldExclamation,
    },
    {
      title: "Systems",
      url: "/dashboard/systems",
      icon: IconServer,
    },
    {
      title: "Context",
      url: "/dashboard/context",
      icon: IconListDetails,
    },
    {
      title: "Smart Analytics",
      url: "/dashboard/SmartAnalytics",
      icon: IconChartBar,
    },
    {
      title: "Agent",
      url: "/dashboard/agent",
      icon: IconUsers,
    },
    {
      title: "Reports",
      url: "/dashboard/reports",
      icon: IconReport,
    },
    {
      title: "Realtime Vuln",
      url: "/dashboard/vunlnerabilty",
      icon: IconSearch,
    }
  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#", IconFolder
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],

  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
}

export function AppSidebar({ user }: { user: any }) {
  return (
    <Sidebar collapsible="offcanvas"  >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:\!p-1.5"
            >
              <div className="flex justify-center">
                <Rocket className="w-8! h-8!" />
                <span className="text-4xl! font-extrabold">PaPeR.Ai</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={routes.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ ...user, image: user.image ?? null }} />
      </SidebarFooter>
    </Sidebar>
  )
}
