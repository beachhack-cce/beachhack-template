import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const BASE_URL = 'http://143.110.250.168:8000';

async function fetchWithTimeout(url: string, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new TRPCError({ code: 'TIMEOUT', message: 'Request timed out' });
    }
    throw error;
  }
}

export const analyticsRouter = createTRPCRouter({
  getNodes: publicProcedure.query(async () => {
    try {
      const data = await fetchWithTimeout(`${BASE_URL}/nodes`);
      return data || [];
    } catch (error) {
      console.error('Error fetching nodes:', error);
      return [];
    }
  }),

  getNode: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await fetchWithTimeout(`${BASE_URL}/nodes/${input.clientId}`);
        console.log('Fetched node data:', data);
        return data;
      } catch (error) {
        console.error('Error fetching node:', error);
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Node not found' });
      }
    }),

  getNodeHistory: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await fetchWithTimeout(`${BASE_URL}/nodes/${input.clientId}/history`);
        return data || [];
      } catch (error) {
        console.error('Error fetching node history:', error);
        return [];
      }
    }),

  compareNodes: publicProcedure
    .input(z.object({ id1: z.string(), id2: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await fetchWithTimeout(`${BASE_URL}/compare/${input.id1}/${input.id2}`);
        return data;
      } catch (error) {
        console.error('Error comparing nodes:', error);
        return null;
      }
    }),

  getOutliers: publicProcedure.query(async () => {
    try {
      const data = await fetchWithTimeout(`${BASE_URL}/outliers`);
      return data || [];
    } catch (error) {
      console.error('Error fetching outliers:', error);
      return [];
    }
  }),

  getCluster: publicProcedure.query(async () => {
    try {
      const data = await fetchWithTimeout(`${BASE_URL}/cluster`);
      return data || null;
    } catch (error) {
      console.error('Error fetching cluster:', error);
      return null;
    }
  }),

  getNodeAnomaly: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => {
      try {
        const data = await fetchWithTimeout(`${BASE_URL}/nodes/${input.clientId}/anomaly`);
        return data;
      } catch (error) {
        console.error('Error fetching node anomaly:', error);
        return null;
      }
    }),
});
