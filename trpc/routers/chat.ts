import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { getFederatedMCPClient } from '@/lib/mcp';

export const chatRouter = createTRPCRouter({

    sendMessage: protectedProcedure
        .input(z.object({ text: z.string() }))
        .mutation(async ({ input }) => {
            try {
                const groq = createGroq({
                    apiKey: process.env.GROQ_API_KEY,
                });
                const mcpClient = await getFederatedMCPClient();
                const tools = await mcpClient.tools();

                const result = await streamText({
                    model: groq("moonshotai/kimi-k2-instruct-0905"),
                    messages: [
                        {
                            role: "system",
                            content: `You are a System Health Assistant that monitors federated learning nodes.

You have access to the following tools to check node health:

- **check_node_health**: Check if a specific node is healthy or anomalous. Use this when asked about a node's status. Requires a client_id.

- **list_nodes**: List all registered nodes. Use this to see what nodes are available and their IDs.

- **get_cluster_status**: Get overall fleet health. Use this for a quick overview.

- **get_outliers**: Find nodes behaving abnormally. Use this to detect problems.

- **compare_nodes**: Compare two nodes' behavior. Requires two client_ids.

- **get_node_history**: Get a node's behavioral trend over time.

GUIDELINES:

1. When asked "how is my node?" or "is my server ok?", first call list_nodes to get the client_id, then call check_node_health.

2. Interpret drift_score: 
   - < 1.0: Normal
   - 1.0-2.0: Worth monitoring
   - > 2.0: Anomalous, investigate!

3. Be concise. Report status clearly:
   - "Node is healthy, drift score 0.3"
   - "WARNING: Node is anomalous! Drift score 3.8 - behavior differs significantly from baseline"

4. If a node is warming up (< 5 samples), explain that more data is needed.

5. Always provide actionable insights, not just raw numbers.`,
                        },
                        {
                            role: "user",
                            content: input.text,
                        },
                    ],
                    tools
                });
                console.log("Streaming result:", result);

                let finalText = "";

                for await (const chunk of result.textStream) {
                    finalText += chunk;
                }

                return {
                    output: finalText,
                };
            } catch (error) {
                console.error("Error analyzing text:", error);

                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to analyze text",
                });
            }
        }),
});
