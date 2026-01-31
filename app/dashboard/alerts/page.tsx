"use client";

import React, { useState } from "react";
import { trpc } from "@/trpc/client";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Server,
  Activity,
  Clock,
  RefreshCw,
  Filter,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

type AlertSeverity = "critical" | "warning" | "info" | "resolved";
type AlertFilter = "all" | "critical" | "warning" | "info";

interface Alert {
  id: string;
  nodeId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const { data: nodes, isLoading: nodesLoading, refetch: refetchNodes } =
    trpc.analytics.getNodes.useQuery();
  const { data: outliers, isLoading: outliersLoading } =
    trpc.analytics.getOutliers.useQuery();
  const { data: cluster } = trpc.analytics.getCluster.useQuery();

  const generateAlerts = (): Alert[] => {
    const alerts: Alert[] = [];

    if (nodes && Array.isArray(nodes)) {
      nodes.forEach((node: any) => {
        if (node.outlier_score > 2) {
          alerts.push({
            id: `${node.client_id}-outlier`,
            nodeId: node.client_id,
            severity: "critical",
            title: "High Anomaly Score Detected",
            message: `Node ${node.client_id.slice(
              0,
              8
            )}... has an outlier score of ${node.outlier_score?.toFixed(
              2
            )}, significantly above normal threshold.`,
            timestamp: node.last_seen_human || new Date().toISOString(),
            metric: "Outlier Score",
            value: node.outlier_score,
            threshold: 2,
          });
        } else if (node.outlier_score > 1) {
          alerts.push({
            id: `${node.client_id}-outlier-warn`,
            nodeId: node.client_id,
            severity: "warning",
            title: "Elevated Anomaly Score",
            message: `Node ${node.client_id.slice(0, 8)}... has an elevated outlier score of ${node.outlier_score?.toFixed(
              2
            )}.`,
            timestamp: node.last_seen_human || new Date().toISOString(),
            metric: "Outlier Score",
            value: node.outlier_score,
            threshold: 1,
          });
        }

        if (node.is_stale) {
          alerts.push({
            id: `${node.client_id}-stale`,
            nodeId: node.client_id,
            severity: "warning",
            title: "Node Stale",
            message: `Node ${node.client_id.slice(
              0,
              8
            )}... has not reported recently. Last seen: ${node.last_seen_human}`,
            timestamp: node.last_seen_human || new Date().toISOString(),
            metric: "Status",
          });
        }

        if (node.num_samples < 10) {
          alerts.push({
            id: `${node.client_id}-samples`,
            nodeId: node.client_id,
            severity: "info",
            title: "Low Sample Count",
            message: `Node ${node.client_id.slice(0, 8)}... has only ${node.num_samples} samples collected.`,
            timestamp: node.last_seen_human || new Date().toISOString(),
            metric: "Samples",
            value: node.num_samples,
            threshold: 10,
          });
        }
      });
    }
    if (cluster) {
      if (cluster.outlier_count > 0) {
        alerts.push({
          id: "cluster-outliers",
          nodeId: "cluster",
          severity: cluster.outlier_count > 2 ? "critical" : "warning",
          title: "Cluster Outliers Detected",
          message: `${cluster.outlier_count} node(s) identified as outliers in the cluster.`,
          timestamp: new Date().toISOString(),
          metric: "Outlier Count",
          value: cluster.outlier_count,
        });
      }

      if (cluster.stale_nodes > 0) {
        alerts.push({
          id: "cluster-stale",
          nodeId: "cluster",
          severity: "warning",
          title: "Stale Nodes in Cluster",
          message: `${cluster.stale_nodes} node(s) are currently stale and not reporting.`,
          timestamp: new Date().toISOString(),
          metric: "Stale Nodes",
          value: cluster.stale_nodes,
        });
      }

      if (cluster.avg_distance_from_centroid > 1) {
        alerts.push({
          id: "cluster-drift",
          nodeId: "cluster",
          severity: "warning",
          title: "High Cluster Variance",
          message: `Average distance from centroid is ${cluster.avg_distance_from_centroid?.toFixed(
            2
          )}, indicating high variance.`,
          timestamp: new Date().toISOString(),
          metric: "Avg Distance",
          value: cluster.avg_distance_from_centroid,
          threshold: 1,
        });
      }
    }
    const severityOrder = { critical: 0, warning: 1, info: 2, resolved: 3 };
    return alerts.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    );
  };

  const alerts = generateAlerts();
  const filteredAlerts =
    filter === "all"
      ? alerts
      : alerts.filter((alert) => alert.severity === filter);

  const alertCounts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  const isLoading = nodesLoading || outliersLoading;

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case "info":
        return <Activity className="w-5 h-5 text-blue-400" />;
      case "resolved":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
    }
  };

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "border-red-500/50 bg-red-500/10";
      case "warning":
        return "border-yellow-500/50 bg-yellow-500/10";
      case "info":
        return "border-blue-500/50 bg-blue-500/10";
      case "resolved":
        return "border-green-500/50 bg-green-500/10";
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "warning":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "info":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "resolved":
        return "bg-green-500/20 text-green-400 border-green-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-bl from-black via-green-800/40 to-black text-white p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30">
              <Bell className="h-5 w-5 text-red-400" />
            </span>
            <span>
              System{" "}
              <span className="text-emerald-400" aria-hidden="true">
                Alerts
              </span>
            </span>
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor critical system and node alerts
          </p>
        </div>
        <button
          onClick={() => refetchNodes()}
          disabled={isLoading}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-linear-to-br from-red-900/30 to-red-900 rounded-xl border border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Critical</p>
              <p className="text-3xl font-bold text-red-400">
                {alertCounts.critical}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-linear-to-br from-green-900/30 to-green-900 rounded-xl border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Warning</p>
              <p className="text-3xl font-bold text-yellow-400">
                {alertCounts.warning}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-linear-to-br from-yellow-900/30 to-yellow-900 rounded-xl border border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Info</p>
              <p className="text-3xl font-bold text-blue-400">
                {alertCounts.info}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(["all", "critical", "warning", "info"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              filter === f
                ? "bg-emerald-500 text-black"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && (
              <span className="ml-2 text-sm">
                {f === "critical"
                  ? `(${alertCounts.critical})`
                  : f === "warning"
                  ? `(${alertCounts.warning})`
                  : `(${alertCounts.info})`}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <BellOff className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            No Alerts
          </h3>
          <p className="text-gray-400">
            {filter === "all"
              ? "All systems are operating normally"
              : `No ${filter} alerts at this time`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border transition-all duration-300 ${getSeverityStyles(
                alert.severity
              )}`}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() =>
                  setExpandedAlert(
                    expandedAlert === alert.id ? null : alert.id
                  )
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{alert.title}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getSeverityBadge(
                            alert.severity
                          )}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{alert.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <div className="flex items-center gap-1 text-gray-500 text-xs">
                        <Server className="w-3 h-3" />
                        <span className="font-mono">
                          {alert.nodeId.slice(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                        <Clock className="w-3 h-3" />
                        <span>{alert.timestamp}</span>
                      </div>
                    </div>
                    {expandedAlert === alert.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {expandedAlert === alert.id && (
                <div className="px-4 pb-4 border-t border-gray-700/50 pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-black/30 rounded-lg">
                      <p className="text-gray-400 text-xs mb-1">Node ID</p>
                      <p className="text-white font-mono text-sm">
                        {alert.nodeId}
                      </p>
                    </div>
                    {alert.metric && (
                      <div className="p-3 bg-black/30 rounded-lg">
                        <p className="text-gray-400 text-xs mb-1">Metric</p>
                        <p className="text-white text-sm">{alert.metric}</p>
                      </div>
                    )}
                    {alert.value !== undefined && (
                      <div className="p-3 bg-black/30 rounded-lg">
                        <p className="text-gray-400 text-xs mb-1">Current Value</p>
                        <p className="text-white text-sm font-bold">
                          {alert.value.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {alert.threshold !== undefined && (
                      <div className="p-3 bg-black/30 rounded-lg">
                        <p className="text-gray-400 text-xs mb-1">Threshold</p>
                        <p className="text-white text-sm">{alert.threshold}</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <a
                      href={`/dashboard/SmartAnalytics`}
                      className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      View in Analytics
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}