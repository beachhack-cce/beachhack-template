"use client";

import React, { useState, useEffect } from "react";

interface Host {
  id: string;
  name: string;
  ipAddress?: string;
  status: "online" | "offline" | "pending";
  lastSeen?: string;
  os?: string;
  registrationToken?: string;
  createdAt?: string;
}

function Systems() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [newHostName, setNewHostName] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hosts");
      if (response.ok) {
        const data = await response.json();
        setHosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch hosts:", error);
      setHosts([
        {
          id: "1",
          name: "Production Server",
          ipAddress: "192.168.1.100",
          status: "online",
          lastSeen: new Date().toISOString(),
          os: "Ubuntu 22.04",
          createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
        },
        {
          id: "2",
          name: "Development Server",
          ipAddress: "192.168.1.101",
          status: "offline",
          lastSeen: new Date(Date.now() - 3600000).toISOString(),
          os: "CentOS 8",
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
        },
        {
          id: "3",
          name: "Staging Server",
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = () => {
    return `tkn_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  };

  const handleNextStep = () => {
    if (!newHostName.trim()) return;
    const token = generateToken();
    setGeneratedToken(token);
    setAddStep(2);
  };

  const handleFinishAdd = async () => {
    const mockHost: Host = {
      id: Date.now().toString(),
      name: newHostName,
      status: "pending",
      registrationToken: generatedToken,
      createdAt: new Date().toISOString(),
    };
    setHosts([...hosts, mockHost]);

    // Reset modal state
    setNewHostName("");
    setGeneratedToken("");
    setAddStep(1);
    setShowAddModal(false);
    setCopied(false);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setAddStep(1);
    setNewHostName("");
    setGeneratedToken("");
    setCopied(false);
  };

  const handleDeleteHost = async () => {
    if (!selectedHost) return;

    try {
      const response = await fetch(`/api/hosts/${selectedHost.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setHosts(hosts.filter((h) => h.id !== selectedHost.id));
      }
    } catch (error) {
      console.error("Failed to delete host:", error);
      setHosts(hosts.filter((h) => h.id !== selectedHost.id));
    }

    setSelectedHost(null);
    setShowDeleteConfirm(false);
  };

  const getCurlCommand = () => {
    const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://your-server.com";
    return `curl -sSL ${serverUrl}/api/agent/install | sudo bash -s -- --token "${generatedToken}" --name "${newHostName}"`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getCurlCommand());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getStatusColor = (status: Host["status"]) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "pending":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: Host["status"]) => {
    switch (status) {
      case "online":
        return "text-white";
      case "offline":
        return "text-red-400";
      case "pending":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-bl from-black via-green-950/80 to-black text-white p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Systems</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 hover:bg-green-700 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Host
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
        </div>
      ) : hosts.length === 0 ? (
        <div className="text-center py-12 text-slate-700/50">
          <p>No hosts added yet. Click "Add Host" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((host) => (
            <div
              key={host.id}
              onClick={() => setSelectedHost(host)}
              className="bg-gray-900 border border-green-800 rounded-lg p-4 cursor-pointer hover:border-green-500 hover:shadow-lg hover:shadow-green-900/50 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg text-white">{host.name}</h3>
                <span
                  className={`w-3 h-3 rounded-full ${getStatusColor(host.status)}`}
                  title={host.status}
                ></span>
              </div>
              {host.ipAddress && (
                <p className="text-white text-sm font-mono">
                  {host.ipAddress}
                </p>
              )}
              {host.os && (
                <p className="text-white text-xs mt-1">
                  {host.os}
                </p>
              )}
              {host.status === "pending" && (
                <p className="text-yellow-500 text-xs mt-2 italic">
                  Waiting for agent connection...
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-green-700 rounded-lg p-6 w-full max-w-xl">
            {addStep === 1 ? (
              <>
                <h2 className="text-xl font-bold mb-4 text-white">Add New Host</h2>
                <p className="text-white text-sm mb-4">
                  Enter a name for the host you want to add.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                      Host Name
                    </label>
                    <input
                      type="text"
                      value={newHostName}
                      onChange={(e) => setNewHostName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleNextStep()}
                      className="w-full px-3 py-2 bg-black border border-green-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-white placeholder-green-800"
                      placeholder="e.g., Production Server"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-white hover:bg-green-900/30 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNextStep}
                    disabled={!newHostName.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:text-white text-black font-semibold rounded-lg transition-colors"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2 text-white">Install Agent</h2>
                <p className="text-white text-sm mb-4">
                  Run this command on <span className="text-white font-semibold">{newHostName}</span> to install the agent:
                </p>
                <div className="relative">
                  <pre className="bg-black border border-green-800 rounded-lg p-4 overflow-x-auto text-sm font-mono text-white whitespace-pre-wrap break-all">
                    {getCurlCommand()}
                  </pre>
                </div>
                <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded-lg">
                  <p className="text-white text-xs">
                    <span className="font-bold">Note:</span> The host will appear with "pending" status until the agent connects. Make sure the target server has curl and bash installed.
                  </p>
                </div>
                <div className="flex justify-between gap-3 mt-6">
                  <button
                    onClick={() => {
                      copyToClipboard();
                      handleFinishAdd();
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-black font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy to Clipboard
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedHost && !showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-green-700 rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-white">{selectedHost.name}</h2>
              <button
                onClick={() => setSelectedHost(null)}
                className="text-white hover:text-white transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-green-900">
                <span className="text-white">Status</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${getStatusColor(selectedHost.status)}`}
                  ></span>
                  <span className={`capitalize ${getStatusText(selectedHost.status)}`}>
                    {selectedHost.status}
                  </span>
                </span>
              </div>
              {selectedHost.ipAddress && (
                <div className="flex justify-between py-2 border-b border-green-900">
                  <span className="text-white">IP Address</span>
                  <span className="font-mono text-white">{selectedHost.ipAddress}</span>
                </div>
              )}
              {selectedHost.os && (
                <div className="flex justify-between py-2 border-b border-green-900">
                  <span className="text-white">Operating System</span>
                  <span className="text-white">{selectedHost.os}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-green-900">
                <span className="text-white">Date Added</span>
                <span className="text-white">{formatDate(selectedHost.createdAt)}</span>
              </div>
              {selectedHost.lastSeen && (
                <div className="flex justify-between py-2 border-b border-green-900">
                  <span className="text-white">Last Seen</span>
                  <span className="text-white">
                    {new Date(selectedHost.lastSeen).toLocaleString()}
                  </span>
                </div>
              )}
              {selectedHost.status === "pending" && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                  <p className="text-yellow-500 text-sm">
                    Waiting for agent to connect. Make sure you've run the installation command on the host.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-between gap-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
              <button
                onClick={() => setSelectedHost(null)}
                className="px-4 py-2 bg-green-800 hover:bg-green-700 text-green-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedHost && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-900/50 rounded-full">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-500">Delete Host</h2>
            </div>
            <p className="text-white mb-2">
              Are you sure you want to delete <span className="font-semibold text-green-300">{selectedHost.name}</span>?
            </p>
            <p className="text-white text-sm mb-6">
              This action cannot be undone. The agent on the host will be disconnected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-white hover:bg-green-900/30 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHost}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Delete Host
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Systems;