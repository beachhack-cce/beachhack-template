#!/usr/bin/env python3
"""
Federated Learning MCP Server
==============================
An MCP (Model Context Protocol) server that exposes federated learning
capabilities for natural language interaction with AI assistants.

Usage:
    # Configure in your MCP settings:
    {
        "mcpServers": {
            "federated": {
                "command": "python3",
                "args": ["/path/to/federatedMCP.py"],
                "env": {
                    "FEDERATED_SERVER_URL": "http://143.110.250.168:8080"
                }
            }
        }
    }

Tools provided:
    - check_node_health: Check if a specific node is healthy or anomalous
    - list_nodes: List all registered nodes
    - compare_nodes: Compare behavior of two nodes
    - get_cluster_status: Get overall cluster health
    - get_outliers: Find nodes behaving abnormally
"""

import os
import json
import asyncio
from typing import Any

# MCP SDK imports
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    print("MCP SDK not available. Install with: pip install mcp")

# SSE transport for network mode
try:
    from mcp.server.sse import SseServerTransport
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.responses import JSONResponse
    import uvicorn
    SSE_AVAILABLE = True
except ImportError:
    SSE_AVAILABLE = False

# HTTP client
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("httpx not available. Install with: pip install httpx")


# =============================================================================
# CONFIGURATION
# =============================================================================

FEDERATED_SERVER_URL = os.environ.get(
    "FEDERATED_SERVER_URL", 
    "http://143.110.250.168:8080"
)


# =============================================================================
# HTTP CLIENT
# =============================================================================

async def api_call(endpoint: str) -> dict:
    """Make an async HTTP call to the federated server."""
    if not HTTPX_AVAILABLE:
        return {"error": "httpx not installed"}
    
    url = f"{FEDERATED_SERVER_URL}{endpoint}"
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.ConnectError:
            return {"error": f"Cannot connect to federated server at {FEDERATED_SERVER_URL}"}
        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"error": str(e)}


# =============================================================================
# MCP SERVER
# =============================================================================

if MCP_AVAILABLE:
    server = Server("federated-learning")
    
    # -------------------------------------------------------------------------
    # Tool Definitions
    # -------------------------------------------------------------------------
    
    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """List all available tools."""
        return [
            Tool(
                name="check_node_health",
                title="Check Node Health",
                description="""Check if a specific node is healthy or showing anomalous behavior.
                
This compares the node's current behavior to its historical baseline.
Returns health status (healthy/watching/warning/anomalous) and drift score.

A drift score > 2.0 indicates the node is behaving significantly differently from normal.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "client_id": {
                            "type": "string",
                            "description": "The client ID of the node to check"
                        }
                    },
                    "required": ["client_id"]
                }
            ),
            Tool(
                name="list_nodes",
                title="List Nodes",
                description="""List all registered nodes in the federated learning cluster.

Returns information about each node including:
- Client ID
- Last seen timestamp
- Number of samples collected
- Whether the node is stale (not reporting)
- Outlier score (if enough nodes for comparison)""",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            ),
            Tool(
                name="compare_nodes",
                title="Compare Nodes",
                description="""Compare the behavior of two nodes.

Returns similarity metrics including:
- Cosine similarity (1.0 = identical, 0 = completely different)
- Euclidean distance
- Human-readable interpretation

Use this to check if two servers are behaving similarly.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "node_a": {
                            "type": "string",
                            "description": "Client ID of the first node"
                        },
                        "node_b": {
                            "type": "string",
                            "description": "Client ID of the second node"
                        }
                    },
                    "required": ["node_a", "node_b"]
                }
            ),
            Tool(
                name="get_cluster_status",
                title="Get Cluster Status",
                description="""Get overall health status of the federated learning cluster.

Returns:
- Total and active node counts
- Total samples collected across all nodes
- Average behavioral distance from cluster center
- Number of detected outliers

Good for a quick overview of fleet health.""",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            ),
            Tool(
                name="get_outliers",
                title="Get Outliers",
                description="""Find nodes that are behaving abnormally compared to the cluster.

Returns a list of nodes whose behavior significantly differs from the group.
Each outlier includes:
- Client ID
- Outlier score (z-score from cluster centroid)
- Distance from centroid

Note: Requires at least 3 active nodes to detect cross-node outliers.""",
                inputSchema={
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            ),
            Tool(
                name="get_node_history",
                title="Get Node History",
                description="""Get the behavioral trend history for a specific node.

Returns the last N embeddings stored for the node, useful for understanding
how the node's behavior has evolved over time.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "client_id": {
                            "type": "string",
                            "description": "The client ID of the node"
                        }
                    },
                    "required": ["client_id"]
                }
            )
        ]
    
    # -------------------------------------------------------------------------
    # Tool Implementations
    # -------------------------------------------------------------------------
    
    @server.call_tool()
    async def call_tool(name: str, arguments: dict) -> list[TextContent]:
        """Handle tool calls."""
        
        if name == "check_node_health":
            client_id = arguments.get("client_id", "")
            if not client_id:
                return [TextContent(type="text", text="Error: client_id is required")]
            
            result = await api_call(f"/nodes/{client_id}/anomaly")
            
            if "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            # Format friendly response
            status = result.get("status", "unknown")
            drift = result.get("drift_score", 0)
            interpretation = result.get("interpretation", "")
            
            status_label = {"healthy": "[OK]", "watching": "[WATCH]", "warning": "[WARN]", "anomalous": "[ALERT]", "warming_up": "[WARMING UP]"}.get(status, "[?]")
            
            response = f"""{status_label} **Node Health Report**

**Status:** {status.upper()}
**Drift Score:** {drift} (threshold: 2.0)
**Interpretation:** {interpretation}

**Details:**
- Baseline samples: {result.get('baseline_samples', 'N/A')}
- Current distance from baseline: {result.get('current_distance', 'N/A')}
- Mean historical distance: {result.get('baseline_mean_distance', 'N/A')}
"""
            
            if result.get("message"):
                response = f"[WARMING UP] {result['message']}"
            
            return [TextContent(type="text", text=response)]
        
        elif name == "list_nodes":
            result = await api_call("/nodes")
            
            if isinstance(result, dict) and "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            if not result:
                return [TextContent(type="text", text="No nodes registered yet.")]
            
            response = f"**Registered Nodes ({len(result)})**\n\n"
            
            for node in result:
                stale_icon = "[STALE]" if node.get("is_stale") else "[ACTIVE]"
                response += f"{stale_icon} **{node['client_id'][:16]}**\n"
                response += f"   - Samples: {node.get('num_samples', 0)}\n"
                response += f"   - Updates: {node.get('update_count', 0)}\n"
                response += f"   - Last seen: {node.get('last_seen_human', 'N/A')}\n\n"
            
            return [TextContent(type="text", text=response)]
        
        elif name == "compare_nodes":
            node_a = arguments.get("node_a", "")
            node_b = arguments.get("node_b", "")
            
            if not node_a or not node_b:
                return [TextContent(type="text", text="Error: Both node_a and node_b are required")]
            
            result = await api_call(f"/compare/{node_a}/{node_b}")
            
            if "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            sim = result.get("cosine_similarity", 0)
            interp = result.get("interpretation", "")
            
            # Visual similarity bar
            bar_filled = int(sim * 10)
            bar = "█" * bar_filled + "░" * (10 - bar_filled)
            
            response = f"""**Node Comparison**

**{node_a[:12]}** vs **{node_b[:12]}**

Similarity: [{bar}] {sim:.1%}
{interp}

- Cosine Distance: {result.get('cosine_distance', 'N/A'):.4f}
- Euclidean Distance: {result.get('euclidean_distance', 'N/A'):.4f}
"""
            return [TextContent(type="text", text=response)]
        
        elif name == "get_cluster_status":
            result = await api_call("/cluster")
            
            if "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            total = result.get("total_nodes", 0)
            active = result.get("active_nodes", 0)
            stale = result.get("stale_nodes", 0)
            outliers = result.get("outlier_count", 0)
            
            health = "Healthy" if outliers == 0 else f"{outliers} outlier(s) detected"
            
            response = f"""**Cluster Status**

**Overall Health:** {health}

**Nodes:**
- Total registered: {total}
- Active (reporting): {active}
- Stale (not reporting): {stale}

**Metrics:**
- Total samples: {result.get('total_samples', 0):,}
- Avg distance from centroid: {result.get('avg_distance_from_centroid', 0):.4f}
- Outliers detected: {outliers}
"""
            return [TextContent(type="text", text=response)]
        
        elif name == "get_outliers":
            result = await api_call("/outliers")
            
            if isinstance(result, dict) and "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            if not result:
                return [TextContent(type="text", text="No outliers detected. All nodes are behaving normally.")]
            
            response = f"**Outliers Detected ({len(result)})**\n\n"
            
            for outlier in result:
                response += f"[ALERT] **{outlier['client_id'][:16]}**\n"
                response += f"   - Outlier Score: {outlier.get('outlier_score', 0):.2f}\n"
                response += f"   - Distance from centroid: {outlier.get('distance_from_centroid', 0):.4f}\n\n"
            
            return [TextContent(type="text", text=response)]
        
        elif name == "get_node_history":
            client_id = arguments.get("client_id", "")
            if not client_id:
                return [TextContent(type="text", text="Error: client_id is required")]
            
            result = await api_call(f"/nodes/{client_id}/history")
            
            if "error" in result:
                return [TextContent(type="text", text=f"Error: {result['error']}")]
            
            history = result.get("history", [])
            
            response = f"**Node History: {client_id[:16]}**\n\n"
            response += f"Total samples: {len(history)}\n\n"
            
            # Show last 5 entries
            for entry in history[-5:]:
                ts = entry.get("timestamp", 0)
                emb = entry.get("embedding", [])
                emb_str = ", ".join(f"{e:.2f}" for e in emb[:4]) + "..."
                response += f"- `{ts:.0f}`: [{emb_str}]\n"
            
            return [TextContent(type="text", text=response)]
        
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]


# =============================================================================
# MAIN
# =============================================================================

MCP_PORT = int(os.environ.get("MCP_PORT", "3001"))

async def main_stdio():
    """Run the MCP server in stdio mode (for local use)."""
    print(f"Federated Learning MCP Server starting (stdio mode)...")
    print(f"Connected to: {FEDERATED_SERVER_URL}")
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def create_sse_app():
    """Create a raw ASGI app for MCP SSE transport."""
    sse = SseServerTransport("/messages")
    
    async def app(scope, receive, send):
        """Raw ASGI application handler."""
        if scope["type"] != "http":
            return
        
        path = scope["path"]
        method = scope.get("method", "GET")
        
        # Health check endpoint
        if path == "/health" and method == "GET":
            await send({
                "type": "http.response.start",
                "status": 200,
                "headers": [[b"content-type", b"application/json"]],
            })
            await send({
                "type": "http.response.body",
                "body": b'{"status": "ok", "server": "federated-mcp"}',
            })
            return
        
        # SSE connection endpoint
        if path == "/sse" and method == "GET":
            async with sse.connect_sse(scope, receive, send) as streams:
                await server.run(
                    streams[0], streams[1], server.create_initialization_options()
                )
            return
        
        # POST messages endpoint (for MCP messages)
        if path.startswith("/messages") and method == "POST":
            await sse.handle_post_message(scope, receive, send)
            return
        
        # 404 for everything else
        await send({
            "type": "http.response.start",
            "status": 404,
            "headers": [[b"content-type", b"text/plain"]],
        })
        await send({
            "type": "http.response.body",
            "body": b"Not Found",
        })
    
    return app




def main():
    """Entry point - supports both stdio and SSE modes."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Federated Learning MCP Server')
    parser.add_argument(
        '--mode', choices=['stdio', 'sse'], default='sse',
        help='Transport mode: stdio (local) or sse (network)'
    )
    parser.add_argument(
        '--port', type=int, default=MCP_PORT,
        help='Port for SSE mode (default: 3001)'
    )
    parser.add_argument(
        '--host', type=str, default='0.0.0.0',
        help='Host for SSE mode (default: 0.0.0.0)'
    )
    
    args = parser.parse_args()
    
    if not MCP_AVAILABLE:
        print("MCP SDK not installed. Run: pip install mcp")
        return 1
    
    if not HTTPX_AVAILABLE:
        print("httpx not installed. Run: pip install httpx")
        return 1
    
    if args.mode == 'stdio':
        asyncio.run(main_stdio())
    else:
        if not SSE_AVAILABLE:
            print("SSE dependencies not installed. Run:")
            print("  pip install starlette uvicorn")
            return 1
        
        print(f"Federated Learning MCP Server starting (SSE mode)...")
        print(f"Listening on http://{args.host}:{args.port}")
        print(f"SSE endpoint: http://{args.host}:{args.port}/sse")
        print(f"Connected to federated server: {FEDERATED_SERVER_URL}")
        
        app = create_sse_app()
        uvicorn.run(app, host=args.host, port=args.port)
    
    return 0


if __name__ == "__main__":
    exit(main())
