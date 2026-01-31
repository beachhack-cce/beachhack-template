import { systems } from "@/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/trpc/init";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

export const hostRouter = createTRPCRouter({
  getAll: protectedProcedure
    .query(async ({ ctx }) => {
      const hosts = await ctx.db.select().from(systems).where(eq(systems.userId, ctx.auth?.user?.id as string));
      return hosts;
    }),
  addHost: protectedProcedure
    .input(z.object({
      systemName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hostData = {
        id: nanoid(),
        name: input.systemName,
        status: "pending",
        userId: ctx.auth?.user?.id as string,
        createdAt: new Date().toISOString(),
        agentId: null,
        ipAddress: null,
        os: null
      };
      await ctx.db.insert(systems).values(hostData);
      return hostData;
    }),
  deleteHost: protectedProcedure
    .input(z.object({
      systemId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(systems).where(eq(systems.id, input.systemId));
      return { status: "success" };
    }),
});