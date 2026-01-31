"use client";

import React, { useState } from "react";
import { trpc } from "@/trpc/client";

interface Report {
  id: string;
  title: string;
  description?: string;
  created_at: string | number;
  file_type: string;
  file_size: number;
  file_url?: string;
  content?: string;
}

const mockReports: Report[] = [
  {
    id: "mock-001",
    title: "Monthly Analytics Report",
    description: "Comprehensive analytics overview for the current month",
    created_at: Date.now() - 86400000, // 1 day ago
    file_type: "pdf",
    file_size: 2456789,
    content: "Monthly Analytics Report\n\nThis is a sample report content.\n\nKey Metrics:\n- Total Users: 15,234\n- Active Sessions: 8,456\n- Conversion Rate: 3.2%\n\nSummary:\nThe platform showed steady growth this month with a 12% increase in user engagement.",
  },
  {
    id: "mock-002",
    title: "Node Performance Data",
    description: "Exported node performance metrics and statistics",
    created_at: Date.now() - 172800000, // 2 days ago
    file_type: "csv",
    file_size: 845632,
    content: "node_id,samples,updates,outlier_score,status\nnode-001,125000,45,0.23,active\nnode-002,98500,32,0.45,active\nnode-003,156000,67,1.23,stale\nnode-004,87600,28,0.12,active",
  },
  {
    id: "mock-003",
    title: "Cluster Analysis Export",
    description: "Detailed cluster analysis and node comparisons",
    created_at: Date.now() - 259200000, // 3 days ago
    file_type: "json",
    file_size: 1234567,
    content: JSON.stringify({
      cluster_id: "cluster-main",
      total_nodes: 24,
      active_nodes: 21,
      stale_nodes: 3,
      avg_similarity: 0.87,
      outlier_count: 2
    }, null, 2),
  },
  {
    id: "mock-004",
    title: "Weekly Summary Report",
    description: "Weekly aggregated metrics and insights",
    created_at: Date.now() - 604800000, // 7 days ago
    file_type: "pdf",
    file_size: 3567890,
    content: "Weekly Summary Report\n\nPeriod: Last 7 Days\n\nHighlights:\n- New nodes added: 5\n- Total samples processed: 2.5M+\n- System uptime: 99.9%\n\nRecommendations:\n1. Monitor outlier nodes\n2. Review stale connections",
  },
  {
    id: "mock-005",
    title: "Anomaly Detection Log",
    description: "Log of detected anomalies and their resolutions",
    created_at: Date.now() - 432000000, // 5 days ago
    file_type: "csv",
    file_size: 567234,
    content: "timestamp,node_id,anomaly_type,severity,resolved\n2024-01-15 10:23,node-003,drift,high,yes\n2024-01-14 15:45,node-007,outlier,medium,yes\n2024-01-13 08:12,node-012,stale,low,no",
  },
  {
    id: "mock-006",
    title: "System Health Report",
    description: "Overall system health and performance metrics",
    created_at: Date.now() - 345600000, // 4 days ago
    file_type: "pdf",
    file_size: 1890456,
    content: "System Health Report\n\nStatus: Healthy\n\nComponents:\n- API Server: Online\n- Database: Online\n- Analytics Engine: Online\n\nPerformance:\n- Avg Response Time: 45ms\n- Error Rate: 0.01%",
  },
];

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

function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function Reports() {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  const { data: reports, isLoading, refetch, isError } = trpc.reports.getReports.useQuery(undefined, {
    refetchInterval: 60000, 
    retry: 1,
  });

  const displayReports = (reports && reports.length > 0) ? reports : mockReports;
  const isUsingMockData = !reports || reports.length === 0 || isError;

  const handleView = (report: Report) => {
    setSelectedReport(report);
    setViewModalOpen(true);
  };

  const handleDownload = async (report: Report) => {
    try {
      if (report.file_url) {
        const link = document.createElement("a");
        link.href = report.file_url;
        link.download = `${report.title}.${report.file_type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (report.content) {
        const blob = new Blob([report.content], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${report.title}.${report.file_type}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const closeModal = () => {
    setViewModalOpen(false);
    setSelectedReport(null);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case "pdf":
        return (
          <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v4.5H8.5V13zm3 0h1.5l1 2.5 1-2.5h1.5v4.5h-1.2v-2.8l-.9 2.3h-.8l-.9-2.3v2.8H11.5V13z"/>
          </svg>
        );
      case "csv":
      case "xlsx":
      case "xls":
        return (
          <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h2v2H8v-2zm0 4h2v2H8v-2zm4-4h2v2h-2v-2zm0 4h2v2h-2v-2z"/>
          </svg>
        );
      case "json":
        return (
          <svg className="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h2v2H5v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 0 0-2-2H0v-2h1a2 2 0 0 0 2-2V5a2 2 0 0 1 2-2m14 0a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1v2h-1a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2v-2h2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5h-2V3h2z"/>
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/>
          </svg>
        );
    }
  };

  if (isLoading) {
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
          <h1 className="text-3xl font-bold text-emerald-400">Reports</h1>
          <p className="text-gray-400 mt-1">View and download generated reports</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-6 py-3 rounded-lg font-semibold transition-all duration-300 bg-green-800 text-white border border-emerald-500 hover:bg-emerald-500/20 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {isUsingMockData && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-yellow-400 text-sm">
            Displaying sample reports. Real reports will appear once generated from the system.
          </p>
        </div>
      )}

      {/* Reports Summary */}
      <div className="mb-8 p-6 bg-linear-to-r from-green-900/30 to-green-800/60 backdrop-blur-xl rounded-xl border border-green-700">
        <h2 className="text-xl font-semibold text-emerald-400 mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Reports" value={displayReports?.length || 0} />
          <StatCard 
            label="PDF Reports" 
            value={displayReports?.filter((r: Report) => r.file_type === "pdf").length || 0} 
            color="text-red-400" 
          />
          <StatCard 
            label="CSV Reports" 
            value={displayReports?.filter((r: Report) => r.file_type === "csv").length || 0} 
            color="text-green-400" 
          />
          <StatCard 
            label="Other" 
            value={displayReports?.filter((r: Report) => !["pdf", "csv"].includes(r.file_type)).length || 0} 
            color="text-yellow-400" 
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayReports.map((report: Report) => (
          <div
            key={report.id}
            className="p-6 rounded-xl bg-linear-to-br from-green-900 to-green-800/20 border border-green-700 backdrop-blur-xl hover:border-emerald-500/50 transition-all duration-300"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-black/50 rounded-lg">
                {getFileIcon(report.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{report.title}</h3>
                <p className="text-sm text-gray-400 truncate">{report.description || "No description"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400">Created</p>
                <p className="text-sm text-white">{formatTimestamp(report.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Size</p>
                <p className="text-sm text-white">{formatFileSize(report.file_size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                report.file_type === "pdf" 
                  ? "bg-red-500/20 text-red-400" 
                  : report.file_type === "csv" 
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {report.file_type}
              </span>
              {isUsingMockData && (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400">
                  Sample
                </span>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => handleView(report)}
                className="flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-300 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View
              </button>
              <button
                onClick={() => handleDownload(report)}
                className="flex-1 px-4 py-2 rounded-lg font-semibold transition-all duration-300 bg-green-800 text-white border border-emerald-500 hover:bg-emerald-500/20 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-green-900 rounded-2xl border border-green-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-green-700 flex justify-between items-center">
              <div className="flex items-center gap-4">
                {getFileIcon(selectedReport.file_type)}
                <div>
                  <h2 className="text-xl font-semibold text-emerald-400">{selectedReport.title}</h2>
                  <p className="text-sm text-gray-400">{selectedReport.description || "No description"}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-auto">
              {isUsingMockData && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-sm">This is sample data for demonstration purposes.</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <InfoCard label="File Type" value={selectedReport.file_type.toUpperCase()} />
                <InfoCard label="Size" value={formatFileSize(selectedReport.file_size)} />
                <InfoCard label="Created" value={formatTimestamp(selectedReport.created_at)} />
                <InfoCard label="ID" value={selectedReport.id} mono />
              </div>

              <div className="bg-black/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
                {selectedReport.content ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap overflow-auto max-h-64 font-mono bg-black/30 p-4 rounded-lg">
                    {selectedReport.content.slice(0, 2000)}
                    {selectedReport.content.length > 2000 && "..."}
                  </pre>
                ) : selectedReport.file_url ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-4">Preview not available for this file type</p>
                    <a
                      href={selectedReport.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline"
                    >
                      Open in new tab
                    </a>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No preview available</p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-green-700 flex justify-end gap-4">
              <button
                onClick={closeModal}
                className="px-6 py-2 rounded-lg font-semibold transition-all duration-300 bg-gray-700 text-white hover:bg-gray-600"
              >
                Close
              </button>
              <button
                onClick={() => handleDownload(selectedReport)}
                className="px-6 py-2 rounded-lg font-semibold transition-all duration-300 bg-emerald-500 text-black hover:bg-emerald-400 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
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

export default Reports;
