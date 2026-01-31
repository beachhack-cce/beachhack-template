'use client';

import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Vulnerability } from '@/types/vulnerability';

function SeverityBadge({ severity }: { severity: string }) {
  const getBadgeColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getBadgeColor(severity)}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function VulnerabilityCard({ vuln, onClick }: { vuln: Vulnerability; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-900 border border-green-500/30 rounded-lg p-4 hover:border-green-500 transition-all cursor-pointer hover:shadow-lg hover:shadow-green-500/10"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-green-400 font-mono font-bold">{vuln.cve_id}</h3>
        <SeverityBadge severity={vuln.severity} />
      </div>
      <p className="text-white text-sm mb-2 line-clamp-2">{vuln.description}</p>
      <div className="flex justify-between text-xs text-gray-400">
        <span>Package: {vuln.package_name}</span>
        <span>Score: {vuln.cve_score}</span>
      </div>
    </div>
  );
}

function VulnerabilityModal({ vuln, onClose }: { vuln: Vulnerability; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-green-500 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-green-400 font-mono text-xl font-bold">{vuln.cve_id}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <SeverityBadge severity={vuln.severity} />
              <span className="text-green-500 font-mono">Score: {vuln.cve_score}</span>
            </div>

            <div className="bg-black/50 rounded p-4 space-y-3">
              <div>
                <label className="text-green-500 text-xs uppercase tracking-wide">Description</label>
                <p className="text-white mt-1">{vuln.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-green-500 text-xs uppercase tracking-wide">Package</label>
                  <p className="text-white mt-1">{vuln.package_name} v{vuln.package_version}</p>
                </div>
                <div>
                  <label className="text-green-500 text-xs uppercase tracking-wide">Host</label>
                  <p className="text-white mt-1">{vuln.host}</p>
                </div>
              </div>

              <div>
                <label className="text-green-500 text-xs uppercase tracking-wide">Package Description</label>
                <p className="text-white mt-1">{vuln.package_description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-green-500 text-xs uppercase tracking-wide">Agent</label>
                  <p className="text-white mt-1">{vuln.agent_name}</p>
                  <p className="text-gray-400 text-xs">{vuln.agent_id}</p>
                </div>
                <div>
                  <label className="text-green-500 text-xs uppercase tracking-wide">Dates</label>
                  <p className="text-white mt-1 text-sm">Published: {vuln.published_at}</p>
                  <p className="text-white text-sm">Detected: {vuln.detected_at}</p>
                </div>
              </div>

              <div>
                <label className="text-green-500 text-xs uppercase tracking-wide">Reference</label>
                <a
                  href={vuln.reference}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 mt-1 block break-all"
                >
                  {vuln.reference}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VulnerabilityPage() {
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const { data: vulnerabilities, isLoading, error } = trpc.vulnerability.getAll.useQuery();

  const filteredVulnerabilities = vulnerabilities?.filter((vuln) => {
    const matchesSearch =
      vuln.cve_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vuln.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vuln.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity =
      severityFilter === 'all' || vuln.severity.toLowerCase() === severityFilter.toLowerCase();

    return matchesSearch && matchesSeverity;
  });

  const severityCounts = vulnerabilities?.reduce(
    (acc:any, vuln: any) => {
      const sev = vuln.severity.toLowerCase();
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="min-h-screen bg-linear-to-bl from-black via-green-950/80 to-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-whitefont-mono mb-2">
            <span className='text-red-600'>Vulnerability</span> Assessment
          </h1>
          <p className="text-gray-400">Real-time vulnerability monitoring and analysis</p>
        </div>

        {vulnerabilities && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-900 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{vulnerabilities.length}</p>
              <p className="text-gray-400 text-sm">Total</p>
            </div>
            <div className="bg-gray-900 border border-red-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-500">{severityCounts?.critical || 0}</p>
              <p className="text-gray-400 text-sm">Critical</p>
            </div>
            <div className="bg-gray-900 border border-orange-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-500">{severityCounts?.high || 0}</p>
              <p className="text-gray-400 text-sm">High</p>
            </div>
            <div className="bg-gray-900 border border-yellow-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">{severityCounts?.medium || 0}</p>
              <p className="text-gray-400 text-sm">Medium</p>
            </div>
            <div className="bg-gray-900 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-500">{severityCounts?.low || 0}</p>
              <p className="text-gray-400 text-sm">Low</p>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            placeholder="Search CVE, package, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-gray-900 border border-green-500/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-gray-900 border border-green-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-red-400">
            Error loading vulnerabilities: {error.message}
          </div>
        )}

        {filteredVulnerabilities && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVulnerabilities.map((vuln, index) => (
              <VulnerabilityCard
                key={`${vuln.cve_id}-${index}`}
                vuln={vuln}
                onClick={() => setSelectedVuln(vuln)}
              />
            ))}
          </div>
        )}

        {filteredVulnerabilities?.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No vulnerabilities found matching your criteria.
          </div>
        )}

        {selectedVuln && (
          <VulnerabilityModal vuln={selectedVuln} onClose={() => setSelectedVuln(null)} />
        )}
      </div>
    </div>
  );
}