import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../init";
import { websiteRouter } from "./website";
import { analyticsRouter } from "./analytics";
import { chatRouter } from "./chat";
import { contextRouter } from "./context";
import { vulnerabilityRouter } from './vulnerability';
import { alertRouter } from "./alert";
import { twilioRouter } from "./twilio.router";
import { systemRouter } from "./system.router";
import { hostRouter } from "./host";

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
  alert: alertRouter,
  twilio: twilioRouter,
  system: systemRouter,
  host: hostRouter,
  vulnerability: vulnerabilityRouter
});

export type AppRouter = typeof appRouter;
