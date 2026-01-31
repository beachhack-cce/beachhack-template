import React, { Children } from 'react'
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AIChatWidget } from "./components/AIChatWidget";

function layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" className="bg-green-900 rounded-lg" />
      <SidebarInset className="bg-black text-white min-h-screen">
        <SiteHeader />
        {children}
        <AIChatWidget />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default layout