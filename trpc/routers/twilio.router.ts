import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { z } from "zod";

export const twilioRouter = createTRPCRouter({
  // You may keep this for internal use, but Twilio will not call this directly.
  voiceTwiML: publicProcedure
    .input(
      z.object({
        message: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const message =
        input?.message ??
        "Alert from paper Ai. Suspicious activity detected. Please check your dashboard.";

      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
</Response>`;
    }),
});
