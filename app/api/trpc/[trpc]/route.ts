import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { supabaseAdmin } from "@/lib/supabase";

const t = initTRPC.create({ transformer: superjson });
const router = t.router;
const publicProcedure = t.procedure;

const appRouter = router({
  system: router({
    getAll: publicProcedure.query(async () => {
      const { data, error } = await supabaseAdmin
        .from("system_telemetry")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data as any[]) || [];
      const seen = new Map<string, any>();
      for (const r of rows) {
        if (!seen.has(r.hostname)) seen.set(r.hostname, r);
      }

      const systems = Array.from(seen.values()).map((r) => {
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

        let diskPercent = 0;
        const parts = diskObj?.partitions;
        if (Array.isArray(parts) && parts.length > 0) {
          diskPercent = parts.reduce((max: number, p: any) => {
            const pct = typeof p?.percent === "number" ? p.percent : 0;
            return Math.max(max, pct);
          }, 0);
        }

        const criticalThreshold = 90;
        const warningThreshold = 70;
        let status: "healthy" | "warning" | "critical" = "healthy";
        if (cpuPercent >= criticalThreshold || memPercent >= criticalThreshold || diskPercent >= criticalThreshold) {
          status = "critical";
        } else if (cpuPercent >= warningThreshold || memPercent >= warningThreshold || diskPercent >= warningThreshold) {
          status = "warning";
        }

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
          alertDetails: [],
          lastUpdated: r.created_at,
        };
      });

      return systems;
    }),
  }),
});

export type AppRouter = typeof appRouter;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };