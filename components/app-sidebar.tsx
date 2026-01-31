"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
  IconServer,
  IconShieldExclamation,
  IconNotebook,
} from "@tabler/icons-react"
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
          url: "#",IconFolder
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const {
    data: session,
  } = authClient.useSession();
  
  if(!session){
    return null;
  }
  
  return (
    <Sidebar collapsible="offcanvas" {...props} >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:\!p-1.5 "
            >
              <a href="#">
                <IconNotebook className="\!h-7 \!w-7" size={40} />   
                <span className="text-3xl font-bold">Paper </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={routes.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ ...session.user, image: session.user.image ?? null }} />
      </SidebarFooter>
    </Sidebar>
  )
}
