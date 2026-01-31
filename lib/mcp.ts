import { createMCPClient } from '@ai-sdk/mcp';

export async function getFederatedMCPClient() {
  const client = await createMCPClient({
    transport: {
      type: 'sse',
      url: 'http://143.110.250.168:3001/sse',
    },
  });
  
  return client;
}