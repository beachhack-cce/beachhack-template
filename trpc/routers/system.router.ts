import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "@/db/index";

type RawRow = {
  id: string;
  created_at: string;
  hostname: string;
  system: string | null;
  cpu: string | null;
  memory: string | null;
  disk: string | null;
  network: string | null;
  [k: string]: any;
};

export const systemRouter = createTRPCRouter({
  getAll: publicProcedure.query(async () => {
    const { data, error } = await db
      .from("system_telemetry")
      .select("*")
      .order("created_at", { ascending: false }) // fetch newest first
      .limit(1000);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const rows = (data as RawRow[]) || [];

    // dedupe by hostname keeping the first (newest) row per host
    const seen = new Map<string, RawRow>();
    for (const r of rows) {
      if (!seen.has(r.hostname)) seen.set(r.hostname, r);
    }

    const systems = Array.from(seen.values()).map((r) => {
      // safe parse helpers
      const safeParse = (s?: string | null) => {
        try {
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      };

      const cpuObj = safeParse(r.cpu) as any;
      const memObj = safeParse(r.memory) as any;
      const diskObj = safeParse(r.disk) as any;
      const netObj = safeParse(r.network) as any;

      const cpuPercent = typeof cpuObj?.percent === "number" ? cpuObj.percent : 0;
      const memPercent = typeof memObj?.percent === "number" ? memObj.percent : 0;

      // compute disk percent as the highest partition percent if available
      let diskPercent = 0;
      try {
        const parts = diskObj?.partitions;
        if (Array.isArray(parts) && parts.length > 0) {
          diskPercent = parts.reduce((max: number, p: any) => {
            const pct = typeof p?.percent === "number" ? p.percent : 0;
            return Math.max(max, pct);
          }, 0);
        }
      } catch {
        diskPercent = 0;
      }

      // derive status
      const criticalThreshold = 90;
      const warningThreshold = 70;
      let status: "healthy" | "warning" | "critical" = "healthy";
      if (cpuPercent >= criticalThreshold || memPercent >= criticalThreshold || diskPercent >= criticalThreshold) {
        status = "critical";
      } else if (cpuPercent >= warningThreshold || memPercent >= warningThreshold || diskPercent >= warningThreshold) {
        status = "warning";
      }

      // compute alerts count (simple heuristics)
      const alerts: number[] = [];
      if (cpuPercent >= warningThreshold) alerts.push(1);
      if (memPercent >= warningThreshold) alerts.push(1);
      if (diskPercent >= warningThreshold) alerts.push(1);

      return {
        id: r.id,
        name: r.hostname,
        hostname: r.hostname,
        system: r.system ?? "",
        created_at: r.created_at,
        cpu: Math.round((cpuPercent + Number.EPSILON) * 10) / 10,
        ram: Math.round((memPercent + Number.EPSILON) * 10) / 10,
        disk: Math.round((diskPercent + Number.EPSILON) * 10) / 10,
        network: netObj ?? null,
        status,
        alerts: alerts.length,
        alertDetails: [], // optionally fill with details
        lastUpdated: r.created_at,
      };
    });
    console.log(systems);
    return systems;
  }),
});
