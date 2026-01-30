import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

const websiteInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  industry: z.string(),
  services: z.string(),
  contactEmail: z.string(),
  phone: z.string(),
  address: z.string(),
  socialLinks: z.string(),
});

export const websiteRouter = createTRPCRouter({
  analyze: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      try {
        const websiteResponse = await fetch(input.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WebsiteAnalyzer/1.0)",
          },
        });

        if (!websiteResponse.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to fetch website",
          });
        }

        const html = await websiteResponse.text();

        const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
                content: `You are a website analyzer. Extract business or portfolio information from the provided HTML content. Return a JSON object with the following fields:
                - name: The business or portfolio name
                - description: A brief description of what the business/portfolio is about
                - industry: The industry or category (e.g., Technology, Healthcare, Design)
                - services: List of services or products offered (as a comma-separated string)
                - contactEmail: Contact email if found
                - phone: Phone number if found
                - address: Physical address if found
                - socialLinks: Social media links found (as newline-separated string)
                
                If a field cannot be determined, return an empty string for that field.
                Return ONLY valid JSON, no markdown code blocks or additional text.`,
              },
              {
                role: "user",
                content: `Analyze this website (URL: ${input.url}) and extract information:\n\n${html.substring(0, 12000)}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 1024,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("Groq API error:", aiResponse.status, errorText);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AI analysis failed: ${aiResponse.status}`,
          });
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices[0].message.content;

        let extractedInfo;
        try {
          const cleanedContent = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();
          extractedInfo = JSON.parse(cleanedContent);
        } catch {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedInfo = JSON.parse(jsonMatch[0]);
          } else {
            console.error("Failed to parse AI response:", content);
            throw new Error("Failed to parse AI response as JSON");
          }
        }

        return websiteInfoSchema.parse(extractedInfo);
      } catch (error) {
        console.error("Error analyzing website:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to analyze website",
        });
      }
    }),

  saveContext: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        ...websiteInfoSchema.shape,
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log("Saving context for user:", ctx.auth?.user?.id, input);
      return { success: true, message: "Context saved successfully" };
    }),

  getContext: protectedProcedure
    .input(z.object({ url: z.string().url().optional() }).optional())
    .query(async ({ ctx }) => {
      return null;
    }),
});