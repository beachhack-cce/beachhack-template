import { SectionCards } from "@/components/section-cards";

export default function Overview() {
  return (
    <div className="min-h-screen flex flex-1 flex-col bg-linear-to-bl from-black via-green-88/200/20 to-black">
      <div className="flex flex-col gap-4 py-4 md:py-6 w-full">
        <SectionCards />

        <div className="px-4">
        
        </div>
      </div>
    </div>
  );
}
