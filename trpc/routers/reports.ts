import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

export const reportsRouter = createTRPCRouter({
  generateReport: protectedProcedure
    .input(
      z.object({
        topic: z.string(),
        details: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are a report generation assistant. Create a detailed report based on the provided topic and details.`,
              },
              {
                role: "user",
                content: `Generate a report on the following topic: ${input.topic}. ${
                  input.details ? `Here are some additional details to include: ${input.details}` : ""
                }`,
              },
            ],
            max_tokens: 2000,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate report",
          });
        }

        const data = await response.json();
        const report = data.choices[0].message.content;

        return { report };
      } catch (error) {
        console.error("Error generating report:", error);

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate report",
        });
      }
    }),
});