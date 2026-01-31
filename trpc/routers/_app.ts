import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import { websiteRouter } from "./website";
import { analyticsRouter } from "./analytics";
import { chatRouter } from "./chat";
import { contextRouter } from "./context";
import { vulnerabilityRouter } from './vulnerability';

export const appRouter = createTRPCRouter({
  test: publicProcedure.query(async (opts) => {
    return {
      status: "success",
    };
  }),
  website: websiteRouter,
  analytics: analyticsRouter,
  chat: chatRouter,
  context: contextRouter,
  vulnerability: vulnerabilityRouter
});

export type AppRouter = typeof appRouter;
