import React, { Children } from 'react'
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AIChatWidget } from "./components/ai-chat-widget";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!authSession?.user) {
    redirect("/login");
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar user={authSession.user} />
      <SidebarInset className="bg-black text-white min-h-screen">
        <SiteHeader />
        {children}
        <AIChatWidget />
      </SidebarInset>
    </SidebarProvider>
  )
}