import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"


export default function Overview() {
  return (
    <div className="min-h-screen flex flex-1 flex-col bg-gradient-to-br from-black via-green-950/20 to-black">
      <div className="flex flex-col gap-4 py-4 md:py-6 w-full">
        <SectionCards />
        
        <div className="px-4 lg:px-6">
          <div className="rounded-xl border border-green-500/20 bg-black/60 backdrop-blur-sm p-4 shadow-lg shadow-green-500/5">
            <ChartAreaInteractive />
          </div>
        </div>
      </div>
    </div>
  )
}
