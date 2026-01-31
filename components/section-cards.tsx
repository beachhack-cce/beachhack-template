"use client"

import { useState } from "react"
import { Cpu, MemoryStick, Monitor, AlertTriangle, CheckCircle, Server, Clock, HardDrive, Network, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { trpc } from "@/trpc/client"

interface Alert {
  id: number
  type: "warning" | "critical" | "info"
  message: string
  timestamp: string
}

interface SystemMetric {
  id: string
  name: string
  cpu: number
  ram: number
  status: "healthy" | "warning" | "critical"
  alerts: number
  alertDetails: Alert[]
  disk: number
  network: any
  uptime?: string
  lastUpdated: string
  cpuHistory?: number[]
  ramHistory?: number[]
  processes?: number
  ipAddress?: string
  os?: string
}

function getStatusColor(status: string) {
  switch (status) {
    case "healthy":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    case "critical":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }
}

function getAlertTypeColor(type: string) {
  switch (type) {
    case "critical":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    case "info":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30"
  }
}

function getUsageColor(value: number) {
  if (value >= 90) return "text-red-400"
  if (value >= 70) return "text-yellow-400"
  return "text-green-400"
}

function UsageBar({ value, label }: { value: number; label: string }) {
  const barColor = value >= 90 ? "bg-red-500" : value >= 70 ? "bg-yellow-500" : "bg-green-500"
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={getUsageColor(value)}>{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data || [0])
  const min = Math.min(...data || [0])
  const range = max - min || 1
  
  return (
    <div className="flex items-end gap-1 h-8">
      {(data || []).map((value, index) => (
        <div
          key={index}
          className={`w-2 ${color} rounded-t opacity-70 hover:opacity-100 transition-opacity`}
          style={{ height: `${((value - min) / range) * 100}%`, minHeight: '4px' }}
        />
      ))}
    </div>
  )
}

function SystemDetailDialog({ system, open, onClose }: { system: SystemMetric | null; open: boolean; onClose: () => void }) {
  if (!system) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-black/95 border-green-500/30 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/30">
                <Monitor className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{system.name}</h2>
                <p className="text-sm text-gray-400">{system.ipAddress ?? ""} • {system.os ?? ""}</p>
              </div>
            </div>
            <Badge variant="outline" className={`${getStatusColor(system.status)} capitalize`}>
              {system.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Clock className="h-3 w-3" />
                Uptime
              </div>
              <p className="text-white font-medium text-sm">{system.uptime ?? "n/a"}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Activity className="h-3 w-3" />
                Processes
              </div>
              <p className="text-white font-medium text-sm">{system.processes ?? "n/a"}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <HardDrive className="h-3 w-3" />
                Disk
              </div>
              <p className={`font-medium text-sm ${getUsageColor(system.disk)}`}>{system.disk}%</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Network className="h-3 w-3" />
                Network
              </div>
              <p className={`font-medium text-sm ${getUsageColor(0)}`}>{/* show bytes or rate if available */}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/60 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-green-400" />
                  <span className="text-white font-medium">CPU Usage</span>
                </div>
                <span className={`text-2xl font-bold ${getUsageColor(system.cpu)}`}>{system.cpu}%</span>
              </div>
              <UsageBar value={system.cpu} label="" />
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">History (last 6 readings)</p>
                <MiniChart data={system.cpuHistory ?? [system.cpu]} color={system.cpu >= 90 ? "bg-red-500" : system.cpu >= 70 ? "bg-yellow-500" : "bg-green-500"} />
              </div>
            </div>

            <div className="bg-black/60 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-green-400" />
                  <span className="text-white font-medium">RAM Usage</span>
                </div>
                <span className={`text-2xl font-bold ${getUsageColor(system.ram)}`}>{system.ram}%</span>
              </div>
              <UsageBar value={system.ram} label="" />
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-2">History (last 6 readings)</p>
                <MiniChart data={system.ramHistory ?? [system.ram]} color={system.ram >= 90 ? "bg-red-500" : system.ram >= 70 ? "bg-yellow-500" : "bg-green-500"} />
              </div>
            </div>
          </div>

          <div className="bg-black/60 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-green-400" />
                <span className="text-white font-medium">Alerts</span>
              </div>
              <Badge variant="outline" className={system.alerts > 0 ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}>
                {system.alerts} Active
              </Badge>
            </div>
            
            {system.alertDetails.length > 0 ? (
              <div className="space-y-2">
                {system.alertDetails.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertTypeColor(alert.type)}`}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{alert.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{alert.timestamp}</p>
                    </div>
                    <Badge variant="outline" className={`${getAlertTypeColor(alert.type)} capitalize text-xs`}>
                      {alert.type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <CheckCircle className="h-5 w-5 mr-2 text-green-400" />
                <span>No active alerts</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-green-500/10">
            <span>Last updated: {system.lastUpdated}</span>
            <Button 
              variant="outline" 
              size="sm"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
            >
              View Full Logs
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function SectionCards() {
  const [selectedSystem, setSelectedSystem] = useState<SystemMetric | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // fetch from trpc
  const { data: systems, isLoading, error } = trpc.system.getAll.useQuery()

  const handleCardClick = (system: SystemMetric) => {
    setSelectedSystem(system)
    setDialogOpen(true)
  }

  return (
    <div className="px-4 lg:px-6">
      <div className="mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2">
          <Server className="h-5 w-5 text-green-400" />
          System <span className="text-green-400">Metrics</span>
        </h2>
        <p className="text-gray-400 text-xs mt-1">Click on a system to view detailed information</p>
      </div>

      {isLoading && <div className="text-gray-400">Loading systems...</div>}
      {error && <div className="text-red-400">Failed to load systems</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {(systems || []).map((system: SystemMetric) => (
          <Card 
            key={system.id} 
            className="bg-black/60 backdrop-blur-sm border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 cursor-pointer"
            onClick={() => handleCardClick(system)}
          >
            <CardHeader className="pb-2 pt-3 px-3 md:px-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-xs md:text-sm font-medium text-white flex items-center gap-1.5 truncate">
                  <Monitor className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span className="truncate">{system.name}</span>
                </CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  {system.alerts > 0 && (
                    <Badge 
                      variant="outline" 
                      className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1 py-0 h-5"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      {system.alerts}
                    </Badge>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] px-1 py-0 h-5 ${getStatusColor(system.status)}`}
                  >
                    {system.status === "healthy" && <CheckCircle className="h-2.5 w-2.5" />}
                    {system.status === "warning" && <AlertTriangle className="h-2.5 w-2.5" />}
                    {system.status === "critical" && <AlertTriangle className="h-2.5 w-2.5" />}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-3 md:px-4 pb-3 pt-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-green-500/10 border border-green-500/20">
                  <Cpu className="h-3 w-3 text-green-400" />
                </div>
                <div className="flex-1">
                  <UsageBar value={system.cpu} label="CPU" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded bg-green-500/10 border border-green-500/20">
                  <MemoryStick className="h-3 w-3 text-green-400" />
                </div>
                <div className="flex-1">
                  <UsageBar value={system.ram} label="RAM" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-black/60 backdrop-blur-sm border border-green-500/20 rounded-lg p-2.5 md:p-3">
          <p className="text-[10px] md:text-xs text-gray-400">Total Systems</p>
          <p className="text-lg md:text-xl font-bold text-white">{(systems || []).length}</p>
        </div>
        <div className="bg-black/60 backdrop-blur-sm border border-green-500/20 rounded-lg p-2.5 md:p-3">
          <p className="text-[10px] md:text-xs text-gray-400">Healthy</p>
          <p className="text-lg md:text-xl font-bold text-green-400">
            {(systems || []).filter((s: SystemMetric) => s.status === "healthy").length}
          </p>
        </div>
        <div className="bg-black/60 backdrop-blur-sm border border-green-500/20 rounded-lg p-2.5 md:p-3">
          <p className="text-[10px] md:text-xs text-gray-400">Warnings</p>
          <p className="text-lg md:text-xl font-bold text-yellow-400">
            {(systems || []).filter((s: SystemMetric) => s.status === "warning").length}
          </p>
        </div>
        <div className="bg-black/60 backdrop-blur-sm border border-green-500/20 rounded-lg p-2.5 md:p-3">
          <p className="text-[10px] md:text-xs text-gray-400">Critical</p>
          <p className="text-lg md:text-xl font-bold text-red-400">
            {(systems || []).filter((s: SystemMetric) => s.status === "critical").length}
          </p>
        </div>
      </div>

      <SystemDetailDialog 
        system={selectedSystem} 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
      />
    </div>
  )
}
