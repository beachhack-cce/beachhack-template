import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

import data from "./data.json"

export default function Page() {
  return (
    <div className="min-h-screen flex flex-1 justify-center items-center flex-col bg-linear-to-br text-white from-black via-green-950/20 to-black">
      <div className="flex flex-col gap-2 bg-black/80 backdrop-blur-sm w-full">
        <div className="flex flex-col gap-4 justify-center items-center py-8 md:gap-6">
          <h1 className="text-3xl font-bold text-white">
            <span className="text-green-400">PAPER AI</span>
          </h1>
          <p className="text-gray-400">AI</p>
        </div>
      </div>
    </div>
  )
}
