"use client";

import React, { useState } from "react";
import { trpc } from "@/trpc/client";
interface NodeData {
  client_id: string;
  last_seen: number;
  last_seen_human: string;
  embedding: number[];
  num_samples: number;
  update_count: number;
  is_stale: boolean;
  outlier_score: number;
}

interface CompareResult {
  node_a: string;
  node_b: string;
  cosine_similarity: number;
  cosine_distance: number;
  euclidean_distance: number;
  interpretation: string;
}

interface ClusterData {
  total_nodes: number;
  active_nodes: number;
  stale_nodes: number;
  total_samples: number;
  centroid: number[];
  avg_distance_from_centroid: number;
  outlier_count: number;
}

function formatTimestamp(timestamp: string | number): string {
  if (!timestamp) return "Unknown";
  
  const date = new Date(typeof timestamp === "number" ? timestamp * 1000 : timestamp);
  
  if (isNaN(date.getTime())) return String(timestamp);
  
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatSampleCount(count: number): string {
  if (!count && count !== 0) return "0";
  
  if (count >= 1000000) {
    const millions = count / 1000000;
    const rounded = Math.floor(millions * 2) / 2;
    return `${rounded}M+`;
  }
  
  return count.toLocaleString();
}

function SmartAnalytics() {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [showTrends, setShowTrends] = useState(false);

  const { data: nodes, isLoading: nodesLoading } = trpc.analytics.getNodes.useQuery(undefined, {
    refetchInterval: 30000, 
  });
  const { data: cluster } = trpc.analytics.getCluster.useQuery(undefined, {
    refetchInterval: 30000, 
  });
  const { data: outliers } = trpc.analytics.getOutliers.useQuery(undefined, {
    refetchInterval: 30000, 
  });
  const { data: nodeAnomaly } = trpc.analytics.getNodeAnomaly.useQuery(
    { clientId: activeNode || "" },
    { 
      enabled: !!activeNode && showTrends,
      refetchInterval: 10000, 
    }
  );
  const { data: compareResult, isLoading: compareLoading } = trpc.analytics.compareNodes.useQuery(
    { id1: selectedNodes[0] || "", id2: selectedNodes[1] || "" },
    { 
      enabled: selectedNodes.length === 2,
      refetchInterval: 30000, 
    }
  );

  const { data: nodeHistory, isLoading: historyLoading } = trpc.analytics.getNodeHistory.useQuery(
    { clientId: activeNode || "" },
    { 
      enabled: !!activeNode && showTrends,
      refetchInterval: 10000, 
    }
  );

  const { data: nodeDetails } = trpc.analytics.getNode.useQuery(
    { clientId: activeNode || "" },
    { 
      enabled: !!activeNode && showTrends,
      refetchInterval: 10000,
    }
  );

  const handleCardClick = (clientId: string) => {
    if (compareMode) {
      if (selectedNodes.includes(clientId)) {
        setSelectedNodes(selectedNodes.filter((id) => id !== clientId));
      } else if (selectedNodes.length < 2) {
        setSelectedNodes([...selectedNodes, clientId]);
      }
    } else {
      setActiveNode(clientId);
      setShowTrends(true);
    }
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    setSelectedNodes([]);
    setShowTrends(false);
    setActiveNode(null);
  };

  const closeTrends = () => {
    setShowTrends(false);
    setActiveNode(null);
  };

  const getInterpretationColor = (interpretation: string) => {
    if (interpretation.includes("identical")) return "text-emerald-400";
    if (interpretation.includes("Very similar")) return "text-green-400";
    if (interpretation.includes("Somewhat")) return "text-yellow-400";
    return "text-red-400";
  };

  const getOutlierColor = (score: number) => {
    if (score < 1) return "text-green-400";
    if (score < 2) return "text-yellow-400";
    return "text-red-400";
  };

  if (nodesLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-bl from-black via-green-950/80 to-black text-white p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-400">Smart Analytics</h1>
          <p className="text-gray-400 mt-1">Monitor and compare node behaviors</p>
        </div>
        <button
          onClick={toggleCompareMode}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            compareMode
              ? "bg-emerald-500 text-black hover:bg-emerald-400"
              : "bg-green-800 text-white bo border border-emerald-500 hover:bg-emerald-500/10"
          }`}
        >
          {compareMode ? "Exit Compare Mode" : "Compare Nodes"}
        </button>
      </div>

      {cluster && (
        <div className="mb-8 p-6 bg-linear-to-r from-green-900/30 to-green-800/60 backdrop-blur-3xl rounded-xl border border-green-700">
          <h2 className="text-xl font-semibold text-emerald-400 mb-4">Cluster Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <StatCard label="Total Nodes" value={cluster.total_nodes} />
            <StatCard label="Active" value={cluster.active_nodes} color="text-green-400" />
            <StatCard label="Stale" value={cluster.stale_nodes} color="text-yellow-400" />
            <StatCard label="Samples" value={formatSampleCount(cluster.total_samples)} />
            <StatCard label="Avg Distance" value={cluster.avg_distance_from_centroid?.toFixed(2)} />
            <StatCard label="Outliers" value={cluster.outlier_count} color="text-red-400" />
          </div>
        </div>
      )}

      {compareMode && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
          <p className="text-emerald-400">
            {selectedNodes.length === 0 && "Select two nodes to compare"}
            {selectedNodes.length === 1 && "Select one more node to compare"}
            {selectedNodes.length === 2 && "Comparing selected nodes..."}
          </p>
        </div>
      )}

      {compareMode && selectedNodes.length === 2 && compareResult && (
        <div className="mb-8 p-6 bg-linear-to-r from-green-900/30 to-green-800/60 backdrop-blur-3xl rounded-xl border border-emerald-500/50">
          <h2 className="text-xl font-semibold text-emerald-400 mb-4">Comparison Results</h2>
          {compareLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="p-4 bg-black/50 rounded-lg">
                <p className="text-gray-400 text-sm">Node A</p>
                <p className="text-white font-mono text-sm truncate">{compareResult.node_a}</p>
              </div>
              <div className="p-4 bg-black/50 rounded-lg">
                <p className="text-gray-400 text-sm">Node B</p>
                <p className="text-white font-mono text-sm truncate">{compareResult.node_b}</p>
              </div>
              <div className="p-4 bg-black/50 rounded-lg">
                <p className="text-gray-400 text-sm">Cosine Similarity</p>
                <p className="text-2xl font-bold text-emerald-400">{compareResult.cosine_similarity?.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-black/50 rounded-lg">
                <p className="text-gray-400 text-sm">Euclidean Distance</p>
                <p className="text-2xl font-bold text-white">{compareResult.euclidean_distance?.toFixed(2)}</p>
              </div>
              <div className="p-4 bg-black/50 rounded-lg">
                <p className="text-gray-400 text-sm">Interpretation</p>
                <p className={`text-lg font-semibold ${getInterpretationColor(compareResult.interpretation)}`}>
                  {compareResult.interpretation}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nodes?.map((node: NodeData) => (
          <NodeCard
            key={node.client_id}
            node={node}
            onClick={() => handleCardClick(node.client_id)}
            isSelected={selectedNodes.includes(node.client_id)}
            compareMode={compareMode}
            getOutlierColor={getOutlierColor}
          />
        ))}
      </div>

      {showTrends && activeNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-green-900 rounded-2xl border border-green-700 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-green-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-emerald-400">Node Trends & Details</h2>
              <button
                onClick={closeTrends}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {nodeDetails && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Node Information</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard label="Client ID" value={nodeDetails.client_id} mono />
                    <InfoCard label="Last Seen" value={formatTimestamp(nodeDetails.last_seen)} />
                    <InfoCard label="Samples" value={formatSampleCount(nodeDetails.num_samples)} />
                    <InfoCard label="Updates" value={nodeDetails.update_count} />
                    <InfoCard
                      label="Status"
                      value={nodeDetails.is_stale ? "Stale" : "Active"}
                      color={nodeDetails.is_stale ? "text-yellow-400" : "text-green-400"}
                    />
                    <InfoCard
                      label="Outlier Score"
                      value={nodeDetails.outlier_score?.toFixed(2)}
                      color={getOutlierColor(nodeDetails.outlier_score)}
                    />
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">History</h3>
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
                  </div>
                ) : nodeHistory && nodeHistory.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-auto">
                    {nodeHistory.map((entry: any, index: number) => (
                      <div
                        key={index}
                        className="p-4 bg-black/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 text-sm">
                            {entry.timestamp ? formatTimestamp(entry.timestamp) : `Entry ${index + 1}`}
                          </span>
                          <span className="text-emerald-400 font-mono text-sm">
                            {entry.value || JSON.stringify(entry).slice(0, 50)}...
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No history available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-white" }: { label: string; value: any; color?: string }) {
  return (
    <div className="p-3 bg-black/30 rounded-lg">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function NodeCard({
  node,
  onClick,
  isSelected,
  compareMode,
  getOutlierColor,
}: {
  node: NodeData;
  onClick: () => void;
  isSelected: boolean;
  compareMode: boolean;
  getOutlierColor: (score: number) => string;
}) {
  const { data: nodeAnomaly } = trpc.analytics.getNodeAnomaly.useQuery(
    { clientId: node.client_id },
    { 
      staleTime: 30000,
      refetchInterval: 40000, 
    }
  );

  const getAnomalyColor = (status: string, isAnomalous: boolean) => {
    if (isAnomalous) return "text-red-400";
    if (status === "healthy") return "text-green-400";
    return "text-yellow-400";
  };

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-[1.02] ${
        isSelected
          ? "bg-emerald-500/20 border-2 border-emerald-500"
          : "bg-linear-to-br from-green-900 to-green-800/20 border backdrop-blur-3xl hover:border-emerald-500/50"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-1">Client ID</p>
          <p className="text-emerald-400 font-mono text-sm truncate">{node.client_id}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          node.is_stale ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
        }`}>
          {node.is_stale ? "Stale" : "Active"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Samples</p>
          <p className="text-lg font-semibold text-white">{formatSampleCount(node.num_samples)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Updates</p>
          <p className="text-lg font-semibold text-white">{node.update_count}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-gray-400">Last Seen</p>
        <p className="text-sm text-white">{formatTimestamp(node.last_seen)}</p>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-700">
        <div>
          <p className="text-md text-gray-400">Anomaly:</p>
          <p className="text-md font-bold text-white">
            {nodeAnomaly?.interpretation?.toUpperCase() ?? "Loading..."}
          </p>
        </div>
        {compareMode && (
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected ? "border-emerald-500 bg-emerald-500" : "border-gray-500"
          }`}>
            {isSelected && (
              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  color = "text-white",
  mono = false,
}: {
  label: string;
  value: any;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="p-4 bg-black/50 rounded-lg">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`${color} ${mono ? "font-mono text-sm truncate" : "font-semibold"}`}>{value}</p>
    </div>
  );
}

export default SmartAnalytics;