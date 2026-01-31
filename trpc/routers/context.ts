import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { z } from "zod";
import { db } from "@/db";
import { businessContext } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const contextRouter = createTRPCRouter({
  get: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const context = await db
        .select()
        .from(businessContext)
        .where(eq(businessContext.userId, input.userId))
        .limit(1);
      
      return context[0] || null;
    }),

  upsert: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        services: z.string().optional(),
        contactEmail: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        socialLinks: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;

      const existing = await db
        .select()
        .from(businessContext)
        .where(eq(businessContext.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        const updated = await db
          .update(businessContext)
          .set(data)
          .where(eq(businessContext.userId, userId))
          .returning();
        return updated[0];
      } else {
        const created = await db
          .insert(businessContext)
          .values({
            id: nanoid(),
            userId,
            ...data,
          })
          .returning();
        return created[0];
      }
    }),

  delete: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .delete(businessContext)
        .where(eq(businessContext.userId, input.userId));
      return { success: true };
    }),
});
