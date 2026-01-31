"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    BackgroundVariant,
    Handle,
    Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    Server,
    Activity,
    BarChart3,
    Mail,
    MessageSquare,
} from "lucide-react";

// Custom Node Component
const CustomNode = ({ data, id }: { data: any; id: string }) => {
    const IconComponent = data.icon;
    const isServerNode = data.label === "Server";

    return (
        <div className="px-5 py-4 shadow-xl rounded-xl border-2 bg-gradient-to-br from-white to-gray-50 min-w-[180px] relative hover:shadow-2xl transition-all duration-200 hover:scale-105"
            style={{ borderColor: data.color }}>
            {/* Input Handle (left side) */}
            <Handle
                type="target"
                position={Position.Left}
                className="w-4 h-4 !border-2 !border-white shadow-md transition-all hover:scale-125"
                style={{ backgroundColor: data.color }}
            />

            <div className="flex items-center gap-3">
                <div
                    className="p-2.5 rounded-lg shadow-sm"
                    style={{ backgroundColor: data.color + "25" }}
                >
                    <IconComponent
                        className="size-6"
                        style={{ color: data.color }}
                    />
                </div>
                <div className="font-bold text-sm text-gray-900">{data.label}</div>
            </div>

            {/* API Input for Server Node */}
            {isServerNode && (
                <div className="mt-3">
                    <Input
                        type="text"
                        placeholder="Enter API (e.g., 20.197.7.126:9100)"
                        value={data.apiEndpoint || ""}
                        onChange={(e) => data.onApiChange?.(id, e.target.value)}
                        className="text-xs h-8"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Output Handle (right side) */}
            <Handle
                type="source"
                position={Position.Right}
                className="w-4 h-4 !border-2 !border-white shadow-md transition-all hover:scale-125"
                style={{ backgroundColor: data.color }}
            />
        </div>
    );
};

const nodeTypes = {
    custom: CustomNode,
};

// Node type definitions
const nodeDefinitions = [
    {
        type: "server",
        label: "Server",
        icon: Server,
        color: "#3b82f6",
    },
    {
        type: "telemetry",
        label: "Telemetry",
        icon: Activity,
        color: "#8b5cf6",
    },
    {
        type: "prometheus",
        label: "Prometheus",
        icon: BarChart3,
        color: "#f97316",
    },
    {
        type: "sendMail",
        label: "Send Mail",
        icon: Mail,
        color: "#10b981",
    },
    {
        type: "sendSms",
        label: "Send SMS",
        icon: MessageSquare,
        color: "#06b6d4",
    },
];

export default function AutomationPage() {
    const router = useRouter();
    const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
    const [nodeId, setNodeId] = useState(0);
    const [metricsData, setMetricsData] = useState<string>("");
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [showMetrics, setShowMetrics] = useState(false);

    const onConnect = useCallback(
        (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Handle API endpoint change for server nodes
    const handleApiChange = useCallback((nodeId: string, apiEndpoint: string) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...node.data, apiEndpoint } }
                    : node
            )
        );
    }, [setNodes]);

    // Add node to canvas
    const addNode = (nodeType: typeof nodeDefinitions[0]) => {
        const newNode: Node = {
            id: `${nodeType.type}-${nodeId}`,
            type: "custom",
            position: {
                x: Math.random() * 400 + 100,
                y: Math.random() * 300 + 100,
            },
            data: {
                label: nodeType.label,
                icon: nodeType.icon,
                color: nodeType.color,
                apiEndpoint: "",
                onApiChange: handleApiChange,
            },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeId((id) => id + 1);
    };

    // Drag and drop handlers
    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData("application/reactflow");
            if (!type) return;

            const nodeDef = nodeDefinitions.find((n) => n.type === type);
            if (!nodeDef) return;

            const reactFlowBounds = (
                event.target as HTMLElement
            ).getBoundingClientRect();
            const position = {
                x: event.clientX - reactFlowBounds.left - 80,
                y: event.clientY - reactFlowBounds.top - 20,
            };

            const newNode: Node = {
                id: `${nodeDef.type}-${nodeId}`,
                type: "custom",
                position,
                data: {
                    label: nodeDef.label,
                    icon: nodeDef.icon,
                    color: nodeDef.color,
                    apiEndpoint: "",
                    onApiChange: handleApiChange,
                },
            };

            setNodes((nds) => [...nds, newNode]);
            setNodeId((id) => id + 1);
        },
        [nodeId, setNodes]
    );

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
    };

    // Execute workflow - fetch metrics from server node
    const executeWorkflow = async () => {
        // Find if prometheus is connected to server
        const prometheusNode = nodes.find(n => n.data.label === "Prometheus");
        const serverNode = nodes.find(n => n.data.label === "Server");

        if (!prometheusNode || !serverNode) {
            alert("Please add both Prometheus and Server nodes");
            return;
        }

        // Check if they are connected
        const isConnected = edges.some(
            edge =>
                (edge.source === prometheusNode.id && edge.target === serverNode.id) ||
                (edge.source === serverNode.id && edge.target === prometheusNode.id)
        );

        if (!isConnected) {
            alert("Please connect Prometheus and Server nodes");
            return;
        }

        const apiEndpoint = serverNode.data.apiEndpoint;
        if (!apiEndpoint) {
            alert("Please enter an API endpoint in the Server node");
            return;
        }

        setIsLoadingMetrics(true);
        setShowMetrics(true);

        try {
            const response = await fetch(`http://${apiEndpoint}/metrics`);
            const data = await response.text();
            setMetricsData(data);
        } catch (error) {
            console.error("Error fetching metrics:", error);
            setMetricsData(`Error fetching metrics: ${error}`);
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="border-b bg-background px-6 py-4 flex items-center gap-4 z-10">
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => router.push("/pipeline")}
                >
                    <ArrowLeft className="size-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Workflow Automation</h1>
                    <p className="text-sm text-muted-foreground">
                        Drag nodes from the palette and connect them to build your workflow
                    </p>
                </div>
                <Button
                    variant="default"
                    onClick={executeWorkflow}
                    disabled={isLoadingMetrics}
                    className="mr-2"
                >
                    {isLoadingMetrics ? "Loading..." : "Execute"}
                </Button>
                <Button variant="outline">Save Workflow</Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Node Palette */}
                <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
                    <h2 className="font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">
                        Node Palette
                    </h2>
                    <div className="space-y-3">
                        {nodeDefinitions.map((nodeDef) => {
                            const IconComponent = nodeDef.icon;
                            return (
                                <Card
                                    key={nodeDef.type}
                                    className="p-4 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 hover:scale-102 bg-white border-2"
                                    style={{
                                        borderColor: nodeDef.color + "40",
                                    }}
                                    draggable
                                    onDragStart={(e) => onDragStart(e, nodeDef.type)}
                                    onClick={() => addNode(nodeDef)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="p-2.5 rounded-lg shadow-sm"
                                            style={{
                                                backgroundColor: nodeDef.color + "25",
                                            }}
                                        >
                                            <IconComponent
                                                className="size-5"
                                                style={{ color: nodeDef.color }}
                                            />
                                        </div>
                                        <span className="font-semibold text-sm text-gray-900">
                                            {nodeDef.label}
                                        </span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-900 dark:text-blue-100">
                            💡 <strong>Tip:</strong> Drag nodes onto the canvas or click to add them. Connect nodes by dragging from one node's edge to another.
                        </p>
                    </div>
                </div>

                {/* Center - React Flow Canvas */}
                <div className="flex-1 bg-gradient-to-br from-gray-50 to-gray-100">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                        className="bg-gradient-to-br from-gray-50 to-gray-100"
                        defaultEdgeOptions={{
                            animated: true,
                            style: { stroke: '#94a3b8', strokeWidth: 2 },
                        }}
                    >
                        <Controls className="bg-white shadow-lg rounded-lg border-2 border-gray-200" />
                        <MiniMap
                            nodeColor={(node) => {
                                return (node.data.color as string) || "#3b82f6";
                            }}
                            className="bg-white border-2 border-gray-300 shadow-lg rounded-lg"
                        />
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} className="bg-gray-50" />
                    </ReactFlow>
                </div>

                {/* Right Sidebar - Metrics Display */}
                {showMetrics && (
                    <div className="w-96 border-l bg-white p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-lg">Metrics Data</h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowMetrics(false)}
                            >
                                Close
                            </Button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 border">
                            <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                                {metricsData || "No data available"}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
