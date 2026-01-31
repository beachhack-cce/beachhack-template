#!/usr/bin/env python3
"""
Federated Aggregator Server
============================
A lightweight server that receives updates from federated learning clients,
aggregates model weights using FedAvg, and provides APIs for comparing
node behaviors and detecting anomalies.

Usage:
    pip install fastapi uvicorn numpy
    python3 federatedServer.py
    
    Or with uvicorn directly:
    uvicorn federatedServer:app --host 0.0.0.0 --port 8080

Endpoints:
    POST /federated/update     - Receive client updates
    GET  /nodes                - List all registered nodes
    GET  /nodes/{client_id}    - Get single node details
    GET  /compare/{id1}/{id2}  - Compare two nodes
    GET  /outliers             - List nodes behaving abnormally
    GET  /cluster              - Get cluster statistics
    GET  /health               - Health check
"""

import time
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict

# External dependencies
try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False
    print("ERROR: FastAPI not installed. Run: pip install fastapi uvicorn")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    print("WARNING: numpy not available, using basic math")

try:
    import uvicorn
    UVICORN_AVAILABLE = True
except ImportError:
    UVICORN_AVAILABLE = False


# =============================================================================
# SECTION 1: CONFIGURATION
# =============================================================================

class Config:
    """Server configuration."""
    HOST: str = "0.0.0.0"
    PORT: int = 8080
    
    # Node management
    NODE_TIMEOUT_SEC: int = 600          # Mark node as stale after 10 min
    MAX_HISTORY_PER_NODE: int = 100      # Keep last N embeddings per node
    
    # Anomaly detection
    OUTLIER_THRESHOLD: float = 2.0       # Z-score threshold for outliers
    MIN_NODES_FOR_OUTLIER: int = 3       # Need at least 3 nodes to detect outliers
    
    # FedAvg
    FEDAVG_MIN_NODES: int = 2            # Minimum nodes to compute FedAvg


# =============================================================================
# SECTION 2: LOGGING
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# =============================================================================
# SECTION 3: DATA MODELS
# =============================================================================

class ClientUpdate(BaseModel):
    """Incoming update from a federated client."""
    client_id: str
    timestamp: float
    update_count: int
    weights: Dict[str, Any]
    embedding: List[float]
    num_samples: int
    signature: Optional[str] = None


class NodeInfo(BaseModel):
    """Response model for node information."""
    client_id: str
    last_seen: float
    last_seen_human: str
    embedding: List[float]
    num_samples: int
    update_count: int
    is_stale: bool
    outlier_score: Optional[float] = None


class ComparisonResult(BaseModel):
    """Response model for node comparison."""
    node_a: str
    node_b: str
    cosine_similarity: float
    cosine_distance: float
    euclidean_distance: float
    interpretation: str


class OutlierInfo(BaseModel):
    """Response model for outlier detection."""
    client_id: str
    outlier_score: float
    distance_from_centroid: float
    is_outlier: bool


class ClusterStats(BaseModel):
    """Response model for cluster statistics."""
    total_nodes: int
    active_nodes: int
    stale_nodes: int
    total_samples: int
    centroid: List[float]
    avg_distance_from_centroid: float
    outlier_count: int


# =============================================================================
# SECTION 4: NODE REGISTRY
# =============================================================================

@dataclass
class NodeState:
    """Internal state for a registered node."""
    client_id: str
    last_seen: float
    embedding: List[float]
    weights: Dict[str, Any]
    num_samples: int
    update_count: int
    embedding_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def is_stale(self, timeout: int = Config.NODE_TIMEOUT_SEC) -> bool:
        """Check if node hasn't reported recently."""
        return (time.time() - self.last_seen) > timeout
    
    def add_to_history(self, embedding: List[float], timestamp: float) -> None:
        """Add embedding to history, evicting old entries."""
        self.embedding_history.append({
            'timestamp': timestamp,
            'embedding': embedding
        })
        # Keep only last N entries
        if len(self.embedding_history) > Config.MAX_HISTORY_PER_NODE:
            self.embedding_history = self.embedding_history[-Config.MAX_HISTORY_PER_NODE:]


class NodeRegistry:
    """In-memory registry of all federated nodes."""
    
    def __init__(self):
        self.nodes: Dict[str, NodeState] = {}
    
    def register_or_update(self, update: ClientUpdate) -> NodeState:
        """Register a new node or update existing one."""
        client_id = update.client_id
        
        if client_id in self.nodes:
            # Update existing node
            node = self.nodes[client_id]
            node.last_seen = update.timestamp
            node.embedding = update.embedding
            node.weights = update.weights
            node.num_samples = update.num_samples
            node.update_count = update.update_count
            node.add_to_history(update.embedding, update.timestamp)
        else:
            # Register new node
            node = NodeState(
                client_id=client_id,
                last_seen=update.timestamp,
                embedding=update.embedding,
                weights=update.weights,
                num_samples=update.num_samples,
                update_count=update.update_count
            )
            node.add_to_history(update.embedding, update.timestamp)
            self.nodes[client_id] = node
            logger.info(f"New node registered: {client_id}")
        
        return node
    
    def get_node(self, client_id: str) -> Optional[NodeState]:
        """Get a node by ID."""
        return self.nodes.get(client_id)
    
    def get_all_nodes(self) -> List[NodeState]:
        """Get all registered nodes."""
        return list(self.nodes.values())
    
    def get_active_nodes(self) -> List[NodeState]:
        """Get only non-stale nodes."""
        return [n for n in self.nodes.values() if not n.is_stale()]
    
    def get_all_embeddings(self, active_only: bool = True) -> List[List[float]]:
        """Get embeddings from all nodes."""
        nodes = self.get_active_nodes() if active_only else self.get_all_nodes()
        return [n.embedding for n in nodes if n.embedding]
    
    def get_all_weights(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get weights from all nodes with their sample counts."""
        nodes = self.get_active_nodes() if active_only else self.get_all_nodes()
        return [
            {'weights': n.weights, 'num_samples': n.num_samples}
            for n in nodes if n.weights
        ]


# =============================================================================
# SECTION 5: VECTOR MATH UTILITIES
# =============================================================================

class VectorMath:
    """Utility functions for embedding operations."""
    
    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not a or not b or len(a) != len(b):
            return 0.0
        
        if NUMPY_AVAILABLE:
            a_np, b_np = np.array(a), np.array(b)
            norm_a, norm_b = np.linalg.norm(a_np), np.linalg.norm(b_np)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(a_np, b_np) / (norm_a * norm_b))
        else:
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = sum(x ** 2 for x in a) ** 0.5
            norm_b = sum(x ** 2 for x in b) ** 0.5
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return dot / (norm_a * norm_b)
    
    @staticmethod
    def cosine_distance(a: List[float], b: List[float]) -> float:
        """Compute cosine distance (1 - similarity)."""
        return 1.0 - VectorMath.cosine_similarity(a, b)
    
    @staticmethod
    def euclidean_distance(a: List[float], b: List[float]) -> float:
        """Compute Euclidean distance between two vectors."""
        if not a or not b or len(a) != len(b):
            return float('inf')
        
        if NUMPY_AVAILABLE:
            return float(np.linalg.norm(np.array(a) - np.array(b)))
        else:
            return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5
    
    @staticmethod
    def centroid(vectors: List[List[float]]) -> List[float]:
        """Compute centroid (mean) of multiple vectors."""
        if not vectors:
            return []
        
        dim = len(vectors[0])
        
        if NUMPY_AVAILABLE:
            return np.mean(vectors, axis=0).tolist()
        else:
            centroid = [0.0] * dim
            for vec in vectors:
                for i, v in enumerate(vec):
                    centroid[i] += v
            return [c / len(vectors) for c in centroid]
    
    @staticmethod
    def std_dev(values: List[float]) -> float:
        """Compute standard deviation."""
        if len(values) < 2:
            return 0.0
        
        if NUMPY_AVAILABLE:
            return float(np.std(values))
        else:
            mean = sum(values) / len(values)
            variance = sum((x - mean) ** 2 for x in values) / len(values)
            return variance ** 0.5


# =============================================================================
# SECTION 6: FEDAVG ENGINE
# =============================================================================

class FedAvgEngine:
    """Implements Federated Averaging algorithm."""
    
    @staticmethod
    def compute_average(node_weights: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Compute weighted average of model weights.
        Each node's contribution is weighted by its num_samples.
        """
        if not node_weights:
            return {}
        
        if len(node_weights) < Config.FEDAVG_MIN_NODES:
            logger.debug("Not enough nodes for FedAvg")
            return {}
        
        # Calculate total samples for weighting
        total_samples = sum(nw['num_samples'] for nw in node_weights)
        if total_samples == 0:
            return {}
        
        # Initialize aggregated structure
        aggregated = {
            'feature_means': {},
            'feature_vars': {},
            'feature_counts': {},
            'step_count': 0
        }
        
        # Aggregate each component
        for nw in node_weights:
            weight = nw['num_samples'] / total_samples
            weights = nw['weights']
            
            # Aggregate feature_means
            if 'feature_means' in weights:
                for key, value in weights['feature_means'].items():
                    if key not in aggregated['feature_means']:
                        aggregated['feature_means'][key] = 0.0
                    aggregated['feature_means'][key] += value * weight
            
            # Aggregate feature_vars
            if 'feature_vars' in weights:
                for key, value in weights['feature_vars'].items():
                    if key not in aggregated['feature_vars']:
                        aggregated['feature_vars'][key] = 0.0
                    aggregated['feature_vars'][key] += value * weight
            
            # Sum feature_counts
            if 'feature_counts' in weights:
                for key, value in weights['feature_counts'].items():
                    if key not in aggregated['feature_counts']:
                        aggregated['feature_counts'][key] = 0
                    aggregated['feature_counts'][key] += value
            
            # Sum step counts
            if 'step_count' in weights:
                aggregated['step_count'] += weights['step_count']
        
        logger.info(f"FedAvg computed from {len(node_weights)} nodes, {total_samples} samples")
        return aggregated


# =============================================================================
# SECTION 7: ANOMALY DETECTOR
# =============================================================================

class AnomalyDetector:
    """Detects outlier nodes based on embedding distances."""
    
    def __init__(self, registry: NodeRegistry):
        self.registry = registry
    
    def compute_outlier_scores(self) -> Dict[str, OutlierInfo]:
        """Compute outlier score for each active node."""
        active_nodes = self.registry.get_active_nodes()
        embeddings = self.registry.get_all_embeddings(active_only=True)
        
        if len(active_nodes) < Config.MIN_NODES_FOR_OUTLIER:
            return {}
        
        # Compute centroid
        centroid = VectorMath.centroid(embeddings)
        
        # Compute distances from centroid
        distances = []
        node_distances = {}
        
        for node in active_nodes:
            dist = VectorMath.euclidean_distance(node.embedding, centroid)
            distances.append(dist)
            node_distances[node.client_id] = dist
        
        # Compute mean and std of distances
        mean_dist = sum(distances) / len(distances) if distances else 0
        std_dist = VectorMath.std_dev(distances)
        
        # Compute z-scores and determine outliers
        results = {}
        for node in active_nodes:
            dist = node_distances[node.client_id]
            
            # Z-score: how many std deviations from mean
            if std_dist > 0:
                z_score = (dist - mean_dist) / std_dist
            else:
                z_score = 0.0
            
            is_outlier = z_score > Config.OUTLIER_THRESHOLD
            
            results[node.client_id] = OutlierInfo(
                client_id=node.client_id,
                outlier_score=z_score,
                distance_from_centroid=dist,
                is_outlier=is_outlier
            )
        
        return results
    
    def get_outliers(self) -> List[OutlierInfo]:
        """Get list of nodes flagged as outliers."""
        scores = self.compute_outlier_scores()
        return [info for info in scores.values() if info.is_outlier]


# =============================================================================
# SECTION 8: FASTAPI APPLICATION
# =============================================================================

if FASTAPI_AVAILABLE:
    app = FastAPI(
        title="Federated Aggregator Server",
        description="Aggregates federated learning updates and detects behavioral anomalies",
        version="1.0.0"
    )
    
    # Enable CORS for dashboard access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Initialize components
    registry = NodeRegistry()
    fedavg_engine = FedAvgEngine()
    anomaly_detector = AnomalyDetector(registry)
    
    # -------------------------------------------------------------------------
    # Health Check
    # -------------------------------------------------------------------------
    
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "nodes_registered": len(registry.nodes),
            "nodes_active": len(registry.get_active_nodes())
        }
    
    # -------------------------------------------------------------------------
    # Federated Update Endpoint
    # -------------------------------------------------------------------------
    
    @app.post("/federated/update")
    async def receive_update(update: ClientUpdate):
        """
        Receive a federated update from a client.
        Returns aggregated weights if available.
        """
        try:
            # Register or update the node
            node = registry.register_or_update(update)
            
            logger.info(
                f"Update from {update.client_id}: "
                f"samples={update.num_samples}, update_count={update.update_count}"
            )
            
            # Compute FedAvg if we have enough nodes
            all_weights = registry.get_all_weights(active_only=True)
            aggregated = fedavg_engine.compute_average(all_weights)
            
            # Compute outlier score for this node
            outlier_scores = anomaly_detector.compute_outlier_scores()
            node_outlier = outlier_scores.get(update.client_id)
            
            response = {
                "status": "ok",
                "timestamp": time.time(),
                "cluster_size": len(registry.get_active_nodes())
            }
            
            if aggregated:
                response["aggregated_weights"] = aggregated
            
            if node_outlier:
                response["outlier_score"] = node_outlier.outlier_score
                response["is_outlier"] = node_outlier.is_outlier
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing update: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    # -------------------------------------------------------------------------
    # Node Listing
    # -------------------------------------------------------------------------
    
    @app.get("/nodes", response_model=List[NodeInfo])
    async def list_nodes():
        """List all registered nodes."""
        nodes = registry.get_all_nodes()
        outlier_scores = anomaly_detector.compute_outlier_scores()
        
        result = []
        for node in nodes:
            outlier_info = outlier_scores.get(node.client_id)
            result.append(NodeInfo(
                client_id=node.client_id,
                last_seen=node.last_seen,
                last_seen_human=datetime.fromtimestamp(node.last_seen).isoformat(),
                embedding=node.embedding,
                num_samples=node.num_samples,
                update_count=node.update_count,
                is_stale=node.is_stale(),
                outlier_score=outlier_info.outlier_score if outlier_info else None
            ))
        
        return result
    
    @app.get("/nodes/{client_id}", response_model=NodeInfo)
    async def get_node(client_id: str):
        """Get details for a specific node."""
        node = registry.get_node(client_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        outlier_scores = anomaly_detector.compute_outlier_scores()
        outlier_info = outlier_scores.get(client_id)
        
        return NodeInfo(
            client_id=node.client_id,
            last_seen=node.last_seen,
            last_seen_human=datetime.fromtimestamp(node.last_seen).isoformat(),
            embedding=node.embedding,
            num_samples=node.num_samples,
            update_count=node.update_count,
            is_stale=node.is_stale(),
            outlier_score=outlier_info.outlier_score if outlier_info else None
        )
    
    # -------------------------------------------------------------------------
    # Node Comparison
    # -------------------------------------------------------------------------
    
    @app.get("/compare/{id1}/{id2}", response_model=ComparisonResult)
    async def compare_nodes(id1: str, id2: str):
        """Compare two nodes by their embeddings."""
        node1 = registry.get_node(id1)
        node2 = registry.get_node(id2)
        
        if not node1:
            raise HTTPException(status_code=404, detail=f"Node {id1} not found")
        if not node2:
            raise HTTPException(status_code=404, detail=f"Node {id2} not found")
        
        cosine_sim = VectorMath.cosine_similarity(node1.embedding, node2.embedding)
        cosine_dist = VectorMath.cosine_distance(node1.embedding, node2.embedding)
        euclidean_dist = VectorMath.euclidean_distance(node1.embedding, node2.embedding)
        
        # Interpret the similarity
        if cosine_sim > 0.95:
            interpretation = "Nearly identical behavior"
        elif cosine_sim > 0.8:
            interpretation = "Very similar behavior"
        elif cosine_sim > 0.5:
            interpretation = "Somewhat similar behavior"
        elif cosine_sim > 0.2:
            interpretation = "Different behavior"
        else:
            interpretation = "Very different behavior - investigate!"
        
        return ComparisonResult(
            node_a=id1,
            node_b=id2,
            cosine_similarity=cosine_sim,
            cosine_distance=cosine_dist,
            euclidean_distance=euclidean_dist,
            interpretation=interpretation
        )
    
    # -------------------------------------------------------------------------
    # Outlier Detection
    # -------------------------------------------------------------------------
    
    @app.get("/outliers", response_model=List[OutlierInfo])
    async def get_outliers():
        """Get list of nodes flagged as behavioral outliers."""
        return anomaly_detector.get_outliers()
    
    # -------------------------------------------------------------------------
    # Cluster Statistics
    # -------------------------------------------------------------------------
    
    @app.get("/cluster", response_model=ClusterStats)
    async def get_cluster_stats():
        """Get overall cluster statistics."""
        all_nodes = registry.get_all_nodes()
        active_nodes = registry.get_active_nodes()
        embeddings = registry.get_all_embeddings(active_only=True)
        
        # Compute centroid
        centroid = VectorMath.centroid(embeddings) if embeddings else []
        
        # Compute average distance from centroid
        if centroid and embeddings:
            distances = [
                VectorMath.euclidean_distance(emb, centroid) 
                for emb in embeddings
            ]
            avg_distance = sum(distances) / len(distances)
        else:
            avg_distance = 0.0
        
        # Count outliers
        outliers = anomaly_detector.get_outliers()
        
        # Total samples across all nodes
        total_samples = sum(n.num_samples for n in active_nodes)
        
        return ClusterStats(
            total_nodes=len(all_nodes),
            active_nodes=len(active_nodes),
            stale_nodes=len(all_nodes) - len(active_nodes),
            total_samples=total_samples,
            centroid=centroid,
            avg_distance_from_centroid=avg_distance,
            outlier_count=len(outliers)
        )
    
    # -------------------------------------------------------------------------
    # Node History (for debugging/analysis)
    # -------------------------------------------------------------------------
    
    @app.get("/nodes/{client_id}/history")
    async def get_node_history(client_id: str):
        """Get embedding history for a node."""
        node = registry.get_node(client_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        return {
            "client_id": client_id,
            "history_length": len(node.embedding_history),
            "history": node.embedding_history
        }
    
    # -------------------------------------------------------------------------
    # Self-Anomaly Detection (single-node)
    # -------------------------------------------------------------------------
    
    @app.get("/nodes/{client_id}/anomaly")
    async def get_node_anomaly(client_id: str):
        """
        Detect if a node is behaving anomalously compared to its own history.
        Works with just ONE node - no need for multiple nodes.
        """
        node = registry.get_node(client_id)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Need at least 5 historical embeddings to establish baseline
        if len(node.embedding_history) < 5:
            return {
                "client_id": client_id,
                "status": "warming_up",
                "message": f"Need at least 5 samples for baseline, have {len(node.embedding_history)}",
                "is_anomalous": False,
                "drift_score": 0.0
            }
        
        # Current embedding
        current = node.embedding
        
        # Historical embeddings (exclude the most recent one)
        historical = [h['embedding'] for h in node.embedding_history[:-1]]
        
        # Compute baseline centroid from history
        baseline_centroid = VectorMath.centroid(historical)
        
        # Compute distances of all historical points to centroid
        historical_distances = [
            VectorMath.euclidean_distance(h, baseline_centroid)
            for h in historical
        ]
        
        # Current distance from baseline
        current_distance = VectorMath.euclidean_distance(current, baseline_centroid)
        
        # Compute z-score (how many std deviations from mean)
        mean_dist = sum(historical_distances) / len(historical_distances)
        std_dist = VectorMath.std_dev(historical_distances)
        
        if std_dist > 0:
            drift_score = (current_distance - mean_dist) / std_dist
        else:
            drift_score = 0.0
        
        # Threshold for anomaly
        ANOMALY_THRESHOLD = 2.0
        is_anomalous = drift_score > ANOMALY_THRESHOLD
        
        # Compute detailed breakdown if we have weights
        details = {}
        if node.weights and 'feature_means' in node.weights:
            # Compare current trend slopes to baseline
            feature_means = node.weights.get('feature_means', {})
            feature_vars = node.weights.get('feature_vars', {})
            feature_counts = node.weights.get('feature_counts', {})
            
            for key in ['slope_memory', 'slope_cpu', 'slope_disk_latency', 
                       'variance_cpu', 'variance_memory', 'variance_latency']:
                if key in feature_means:
                    mean = feature_means[key]
                    var = feature_vars.get(key, 0)
                    count = feature_counts.get(key, 1)
                    std = (var / max(count - 1, 1)) ** 0.5 if count > 1 else 0
                    details[key] = {
                        "baseline_mean": round(mean, 4),
                        "baseline_std": round(std, 4)
                    }
        
        # Interpretation
        if drift_score < 0.5:
            interpretation = "Node is behaving normally"
            status = "healthy"
        elif drift_score < 1.5:
            interpretation = "Slight deviation from baseline, monitoring"
            status = "watching"
        elif drift_score < 2.0:
            interpretation = "Moderate deviation, worth investigating"
            status = "warning"
        else:
            interpretation = "Significant anomaly detected! Behavior differs from learned baseline"
            status = "anomalous"
        
        return {
            "client_id": client_id,
            "status": status,
            "is_anomalous": is_anomalous,
            "drift_score": round(drift_score, 3),
            "threshold": ANOMALY_THRESHOLD,
            "interpretation": interpretation,
            "baseline_samples": len(historical),
            "current_distance": round(current_distance, 4),
            "baseline_mean_distance": round(mean_dist, 4),
            "feature_details": details
        }


# =============================================================================
# SECTION 9: ENTRY POINT
# =============================================================================

def main():
    """Entry point for the federated aggregator server."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Federated Aggregator Server'
    )
    parser.add_argument(
        '--host', type=str, default=Config.HOST,
        help='Host to bind to'
    )
    parser.add_argument(
        '--port', type=int, default=Config.PORT,
        help='Port to listen on'
    )
    parser.add_argument(
        '--reload', action='store_true',
        help='Enable auto-reload for development'
    )
    
    args = parser.parse_args()
    
    if not FASTAPI_AVAILABLE:
        print("ERROR: FastAPI is required. Install with:")
        print("  pip install fastapi uvicorn")
        return 1
    
    if not UVICORN_AVAILABLE:
        print("ERROR: uvicorn is required. Install with:")
        print("  pip install uvicorn")
        return 1
    
    logger.info("=" * 60)
    logger.info("Federated Aggregator Server Starting")
    logger.info(f"Listening on http://{args.host}:{args.port}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "federatedServer:app",
        host=args.host,
        port=args.port,
        reload=args.reload
    )
    
    return 0


if __name__ == '__main__':
    exit(main())
