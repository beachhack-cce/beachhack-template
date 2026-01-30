import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

import data from "./data.json"

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" className="bg-green-900" />
      <SidebarInset className="bg-black text-white">
        <SiteHeader />
        <div className="flex flex-1 flex-col bg-gradient-to-br text-white from-black via-green-950/20 to-black">
          <div className="@container/main flex flex-1 flex-col gap-2 bg-black">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 bg-black">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <div className="rounded-xl border border-green-500/20 bg-green-950/50 backdrop-blur-xl p-4">
                  <ChartAreaInteractive />
                </div>
              </div>
              <div className="px-4 lg:px-6">
                <div className="rounded-xl border border-green-500/20 bg-green-950/30 backdrop-blur-xl">
                  <DataTable data={data} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
