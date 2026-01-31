#!/usr/bin/env python3
"""
Federated Learning Client for System Monitoring
================================================
A lightweight, privacy-preserving trend-learning agent designed to run
continuously on AWS VPS instances. Collects system metrics, learns local
behavioral patterns, and participates in federated learning without
exposing raw data.

Usage:
    curl -O <url>/federatedClient.py
    python3 federatedClient.py

    Or as a systemd service:
    [Unit]
    Description=Federated Learning Client
    After=network.target

    [Service]
    ExecStart=/usr/bin/python3 /path/to/federatedClient.py
    Restart=always
    RestartSec=10

    [Install]
    WantedBy=multi-user.target

Dependencies: pip install psutil requests numpy
"""

import time
import json
import logging
import hashlib
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

# External dependencies (minimal set)
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logging.warning("psutil not available, using mock metrics")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logging.warning("numpy not available, using basic math")

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logging.warning("requests not available, federated updates disabled")


# =============================================================================
# SECTION 1: CONFIGURATION
# =============================================================================

class Config:
    """Centralized configuration for the federated client."""
    
    # Collection settings
    COLLECTION_INTERVAL_SEC: int = 10          # How often to collect metrics
    SLIDING_WINDOW_MINUTES: int = 1          # Size of the sliding window
    FEDERATED_UPDATE_INTERVAL_SEC: int = 30   # How often to send federated updates (5 min)
    
    # Aggregator endpoint (production server)
    AGGREGATOR_ENDPOINT: str = "http://143.110.250.168:8080/federated/update"
    CLIENT_ID: str = ""  # Auto-generated if empty
    
    # Model settings
    EMBEDDING_DIM: int = 8                     # Dimension of trend embeddings
    LEARNING_RATE: float = 0.01                # Local model learning rate
    BASELINE_WARMUP_STEPS: int = 30            # Steps before baseline is stable
    
    # Safety settings
    MAX_RETRIES: int = 3
    RETRY_DELAY_SEC: int = 5
    LOG_LEVEL: str = "INFO"


# =============================================================================
# SECTION 2: LOGGING SETUP
# =============================================================================

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


# =============================================================================
# SECTION 3: METRIC COLLECTION
# =============================================================================

class MetricCollector:
    """
    Collects system metrics using psutil and /proc filesystem.
    Gracefully handles missing metrics by returning None.
    """
    
    def __init__(self):
        self._prev_net_io = None
        self._prev_disk_io = None
        self._prev_page_faults = None
        self._prev_tcp_stats = None
        self._prev_time = None
        self._mock_users = 10  # Base mock value
        
    def collect_all(self) -> Dict[str, Optional[float]]:
        """Collect all metrics and return as a dictionary."""
        metrics = {}
        current_time = time.time()
        
        # Application metrics (mockable)
        metrics.update(self._collect_application_metrics())
        
        # CPU metrics
        metrics.update(self._collect_cpu_metrics())
        
        # Memory metrics
        metrics.update(self._collect_memory_metrics(current_time))
        
        # Disk metrics
        metrics.update(self._collect_disk_metrics(current_time))
        
        # Network metrics
        metrics.update(self._collect_network_metrics(current_time))
        
        # Add timestamp
        metrics['timestamp'] = current_time
        
        self._prev_time = current_time
        return metrics
    
    def _collect_application_metrics(self) -> Dict[str, Optional[float]]:
        """Collect application-level metrics (mocked for standalone operation)."""
        # Simulate realistic-ish values with some variance
        import random
        self._mock_users = max(1, self._mock_users + random.randint(-2, 2))
        
        return {
            'active_users': float(self._mock_users),
            'requests_per_second': float(self._mock_users * random.uniform(0.5, 2.0)),
            'queue_length': float(random.randint(0, max(1, self._mock_users // 2)))
        }
    
    def _collect_cpu_metrics(self) -> Dict[str, Optional[float]]:
        """Collect CPU-related metrics."""
        metrics = {
            'cpu_usage_percent': None,
            'load_average_1m': None,
            'cpu_iowait_percent': None
        }
        
        try:
            if PSUTIL_AVAILABLE:
                # CPU usage percent (non-blocking with interval=0)
                metrics['cpu_usage_percent'] = psutil.cpu_percent(interval=0)
                
                # Load average
                try:
                    load_avg = psutil.getloadavg()
                    metrics['load_average_1m'] = load_avg[0]
                except (AttributeError, OSError):
                    # getloadavg not available on Windows
                    pass
                
                # IO wait from cpu_times_percent
                try:
                    cpu_times = psutil.cpu_times_percent(interval=0)
                    metrics['cpu_iowait_percent'] = getattr(cpu_times, 'iowait', 0.0)
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"CPU metrics collection error: {e}")
        
        return metrics
    
    def _collect_memory_metrics(self, current_time: float) -> Dict[str, Optional[float]]:
        """Collect memory-related metrics."""
        metrics = {
            'memory_used_percent': None,
            'major_page_faults_per_sec': None,
            'swap_in_out_rate': None
        }
        
        try:
            if PSUTIL_AVAILABLE:
                # Memory usage
                mem = psutil.virtual_memory()
                metrics['memory_used_percent'] = mem.percent
                
                # Swap usage
                try:
                    swap = psutil.swap_memory()
                    if self._prev_time and hasattr(swap, 'sin') and hasattr(swap, 'sout'):
                        elapsed = current_time - self._prev_time
                        if elapsed > 0:
                            # Swap in/out rate (bytes per second)
                            metrics['swap_in_out_rate'] = (swap.sin + swap.sout) / elapsed
                except Exception:
                    pass
                
                # Page faults from /proc/vmstat
                try:
                    with open('/proc/vmstat', 'r') as f:
                        vmstat = f.read()
                    for line in vmstat.split('\n'):
                        if line.startswith('pgmajfault'):
                            current_faults = int(line.split()[1])
                            if self._prev_page_faults is not None and self._prev_time:
                                elapsed = current_time - self._prev_time
                                if elapsed > 0:
                                    metrics['major_page_faults_per_sec'] = (
                                        current_faults - self._prev_page_faults
                                    ) / elapsed
                            self._prev_page_faults = current_faults
                            break
                except (FileNotFoundError, PermissionError):
                    pass
        except Exception as e:
            logger.debug(f"Memory metrics collection error: {e}")
        
        return metrics
    
    def _collect_disk_metrics(self, current_time: float) -> Dict[str, Optional[float]]:
        """Collect disk-related metrics."""
        metrics = {
            'disk_io_latency': None,
            'disk_usage_percent': None
        }
        
        try:
            if PSUTIL_AVAILABLE:
                # Disk usage (root partition)
                try:
                    disk = psutil.disk_usage('/')
                    metrics['disk_usage_percent'] = disk.percent
                except Exception:
                    pass
                
                # Disk IO latency estimation
                try:
                    disk_io = psutil.disk_io_counters()
                    if disk_io and self._prev_disk_io and self._prev_time:
                        elapsed = current_time - self._prev_time
                        if elapsed > 0:
                            read_count_delta = disk_io.read_count - self._prev_disk_io.read_count
                            write_count_delta = disk_io.write_count - self._prev_disk_io.write_count
                            read_time_delta = disk_io.read_time - self._prev_disk_io.read_time
                            write_time_delta = disk_io.write_time - self._prev_disk_io.write_time
                            
                            total_ops = read_count_delta + write_count_delta
                            total_time = read_time_delta + write_time_delta
                            
                            if total_ops > 0:
                                # Average latency in milliseconds per operation
                                metrics['disk_io_latency'] = total_time / total_ops
                    
                    self._prev_disk_io = disk_io
                except Exception:
                    pass
        except Exception as e:
            logger.debug(f"Disk metrics collection error: {e}")
        
        return metrics
    
    def _collect_network_metrics(self, current_time: float) -> Dict[str, Optional[float]]:
        """Collect network-related metrics."""
        metrics = {
            'ingress_bytes': None,
            'egress_bytes': None,
            'packet_drops': None,
            'tcp_retransmits': None
        }
        
        try:
            if PSUTIL_AVAILABLE:
                # Network IO
                try:
                    net_io = psutil.net_io_counters()
                    if net_io and self._prev_net_io and self._prev_time:
                        elapsed = current_time - self._prev_time
                        if elapsed > 0:
                            metrics['ingress_bytes'] = (
                                net_io.bytes_recv - self._prev_net_io.bytes_recv
                            ) / elapsed
                            metrics['egress_bytes'] = (
                                net_io.bytes_sent - self._prev_net_io.bytes_sent
                            ) / elapsed
                            metrics['packet_drops'] = (
                                (net_io.dropin + net_io.dropout) - 
                                (self._prev_net_io.dropin + self._prev_net_io.dropout)
                            ) / elapsed
                    
                    self._prev_net_io = net_io
                except Exception:
                    pass
                
                # TCP retransmits from /proc/net/snmp
                try:
                    with open('/proc/net/snmp', 'r') as f:
                        snmp_data = f.read()
                    
                    lines = snmp_data.split('\n')
                    for i, line in enumerate(lines):
                        if line.startswith('Tcp:') and i + 1 < len(lines):
                            headers = line.split()
                            values = lines[i + 1].split()
                            if 'RetransSegs' in headers:
                                idx = headers.index('RetransSegs')
                                current_retrans = int(values[idx])
                                if self._prev_tcp_stats is not None and self._prev_time:
                                    elapsed = current_time - self._prev_time
                                    if elapsed > 0:
                                        metrics['tcp_retransmits'] = (
                                            current_retrans - self._prev_tcp_stats
                                        ) / elapsed
                                self._prev_tcp_stats = current_retrans
                            break
                except (FileNotFoundError, PermissionError, ValueError):
                    pass
        except Exception as e:
            logger.debug(f"Network metrics collection error: {e}")
        
        return metrics


# =============================================================================
# SECTION 4: SLIDING WINDOW BUFFER
# =============================================================================

class SlidingWindowBuffer:
    """
    In-memory buffer that maintains a time-based sliding window of metrics.
    Old data is automatically evicted based on the configured window size.
    """
    
    def __init__(self, window_minutes: int = Config.SLIDING_WINDOW_MINUTES):
        self.window_seconds = window_minutes * 60
        self.buffer: deque = deque()
    
    def add(self, metrics: Dict[str, Optional[float]]) -> None:
        """Add a new metrics sample to the buffer."""
        timestamp = metrics.get('timestamp', time.time())
        self.buffer.append((timestamp, metrics))
        self._evict_old()
    
    def _evict_old(self) -> None:
        """Remove samples older than the window size."""
        cutoff = time.time() - self.window_seconds
        while self.buffer and self.buffer[0][0] < cutoff:
            self.buffer.popleft()
    
    def get_all(self) -> List[Dict[str, Optional[float]]]:
        """Get all samples in the current window."""
        self._evict_old()
        return [m for _, m in self.buffer]
    
    def get_metric_series(self, metric_name: str) -> List[float]:
        """Get a time series for a specific metric, filtering None values."""
        series = []
        for _, metrics in self.buffer:
            val = metrics.get(metric_name)
            if val is not None:
                series.append(float(val))
        return series
    
    def size(self) -> int:
        """Return the number of samples in the buffer."""
        return len(self.buffer)


# =============================================================================
# SECTION 5: FEATURE ENGINEERING
# =============================================================================

class FeatureEngineer:
    """
    Computes derived features from raw metrics:
    - Slopes (rate of change)
    - Ratios (efficiency metrics)
    - Rolling variance (volatility)
    """
    
    @staticmethod
    def compute_slope(series: List[float]) -> float:
        """Compute the linear slope of a time series."""
        if len(series) < 2:
            return 0.0
        
        if NUMPY_AVAILABLE:
            x = np.arange(len(series))
            try:
                slope, _ = np.polyfit(x, series, 1)
                return float(slope)
            except Exception:
                return 0.0
        else:
            # Simple difference-based slope
            return (series[-1] - series[0]) / max(len(series) - 1, 1)
    
    @staticmethod
    def compute_variance(series: List[float]) -> float:
        """Compute the variance of a time series."""
        if len(series) < 2:
            return 0.0
        
        if NUMPY_AVAILABLE:
            return float(np.var(series))
        else:
            mean = sum(series) / len(series)
            return sum((x - mean) ** 2 for x in series) / len(series)
    
    @staticmethod
    def compute_ratio(numerator: float, denominator: float, default: float = 0.0) -> float:
        """Safely compute a ratio."""
        if denominator == 0 or denominator is None:
            return default
        return numerator / denominator
    
    def extract_features(self, buffer: SlidingWindowBuffer) -> Dict[str, float]:
        """Extract all engineered features from the buffer."""
        features = {}
        
        # Get latest metrics for ratio computation
        all_metrics = buffer.get_all()
        if not all_metrics:
            return features
        
        latest = all_metrics[-1]
        
        # === Slopes (Δ metrics) ===
        
        # Memory slope
        mem_series = buffer.get_metric_series('memory_used_percent')
        features['slope_memory'] = self.compute_slope(mem_series)
        
        # CPU slope
        cpu_series = buffer.get_metric_series('cpu_usage_percent')
        features['slope_cpu'] = self.compute_slope(cpu_series)
        
        # Disk latency slope
        disk_latency_series = buffer.get_metric_series('disk_io_latency')
        features['slope_disk_latency'] = self.compute_slope(disk_latency_series)
        
        # Load average slope
        load_series = buffer.get_metric_series('load_average_1m')
        features['slope_load'] = self.compute_slope(load_series)
        
        # === Ratios ===
        
        active_users = latest.get('active_users') or 1.0  # Avoid division by zero
        
        # CPU per user
        cpu_usage = latest.get('cpu_usage_percent') or 0.0
        features['ratio_cpu_per_user'] = self.compute_ratio(cpu_usage, active_users)
        
        # Latency per user
        disk_latency = latest.get('disk_io_latency') or 0.0
        features['ratio_latency_per_user'] = self.compute_ratio(disk_latency, active_users)
        
        # Memory per user
        mem_usage = latest.get('memory_used_percent') or 0.0
        features['ratio_memory_per_user'] = self.compute_ratio(mem_usage, active_users)
        
        # Network per user
        egress = latest.get('egress_bytes') or 0.0
        features['ratio_egress_per_user'] = self.compute_ratio(egress, active_users)
        
        # === Rolling Variance ===
        
        # Latency variance
        features['variance_latency'] = self.compute_variance(disk_latency_series)
        
        # Packet drops variance
        drops_series = buffer.get_metric_series('packet_drops')
        features['variance_packet_drops'] = self.compute_variance(drops_series)
        
        # CPU variance
        features['variance_cpu'] = self.compute_variance(cpu_series)
        
        # Memory variance
        features['variance_memory'] = self.compute_variance(mem_series)
        
        return features


# =============================================================================
# SECTION 6: LOCAL TREND MODEL (LIGHTWEIGHT)
# =============================================================================

class TrendModel:
    """
    A lightweight statistical baseline model for learning normal system behavior.
    Uses exponential moving averages and z-score based anomaly detection.
    Produces embeddings/trend summaries for federated learning.
    
    This is NOT an attack detector - it learns behavioral patterns only.
    """
    
    def __init__(self, embedding_dim: int = Config.EMBEDDING_DIM,
                 learning_rate: float = Config.LEARNING_RATE):
        self.embedding_dim = embedding_dim
        self.learning_rate = learning_rate
        self.step_count = 0
        
        # Running statistics for each feature
        self.feature_means: Dict[str, float] = {}
        self.feature_vars: Dict[str, float] = {}
        self.feature_counts: Dict[str, int] = {}
        
        # Model weights for embedding projection
        self._init_weights()
    
    def _init_weights(self) -> None:
        """Initialize projection weights."""
        # Simple random projection matrix (fixed seed for reproducibility)
        if NUMPY_AVAILABLE:
            np.random.seed(42)
            self.projection_weights = np.random.randn(32, self.embedding_dim) * 0.1
        else:
            import random
            random.seed(42)
            self.projection_weights = [
                [random.gauss(0, 0.1) for _ in range(self.embedding_dim)]
                for _ in range(32)
            ]
    
    def update(self, features: Dict[str, float]) -> Dict[str, Any]:
        """
        Update the model with new features.
        Returns trend summary including embeddings.
        """
        self.step_count += 1
        
        # Update running statistics using Welford's algorithm
        for name, value in features.items():
            if value is None:
                continue
            
            if name not in self.feature_means:
                self.feature_means[name] = value
                self.feature_vars[name] = 0.0
                self.feature_counts[name] = 1
            else:
                count = self.feature_counts[name] + 1
                delta = value - self.feature_means[name]
                self.feature_means[name] += delta / count
                delta2 = value - self.feature_means[name]
                self.feature_vars[name] += delta * delta2
                self.feature_counts[name] = count
        
        # Compute embedding
        embedding = self._compute_embedding(features)
        
        # Compute trend summary
        trend_summary = self._compute_trend_summary(features)
        
        return {
            'embedding': embedding,
            'trend_summary': trend_summary,
            'step': self.step_count
        }
    
    def _compute_embedding(self, features: Dict[str, float]) -> List[float]:
        """Project features to low-dimensional embedding."""
        # Create feature vector from known features
        feature_names = sorted(features.keys())
        feature_vector = []
        
        for name in feature_names[:32]:  # Max 32 features
            val = features.get(name, 0.0)
            if val is None:
                val = 0.0
            # Z-score normalization
            mean = self.feature_means.get(name, 0.0)
            var = self.feature_vars.get(name, 1.0)
            count = self.feature_counts.get(name, 1)
            std = (var / max(count - 1, 1)) ** 0.5 if count > 1 else 1.0
            normalized = (val - mean) / max(std, 1e-6)
            feature_vector.append(normalized)
        
        # Pad to 32 dimensions
        while len(feature_vector) < 32:
            feature_vector.append(0.0)
        
        # Project to embedding dimension
        if NUMPY_AVAILABLE:
            fv = np.array(feature_vector[:32])
            embedding = np.tanh(fv @ self.projection_weights)
            return embedding.tolist()
        else:
            # Manual matrix multiplication
            embedding = []
            for j in range(self.embedding_dim):
                val = sum(feature_vector[i] * self.projection_weights[i][j]
                         for i in range(min(32, len(feature_vector))))
                # tanh activation
                embedding.append((2.0 / (1.0 + 2.718281828 ** (-2 * val))) - 1.0)
            return embedding
    
    def _compute_trend_summary(self, features: Dict[str, float]) -> Dict[str, float]:
        """Compute a summary of current trends."""
        summary = {}
        
        # Extract key trend indicators
        trend_keys = [
            'slope_memory', 'slope_cpu', 'slope_disk_latency', 'slope_load',
            'variance_cpu', 'variance_memory', 'variance_latency'
        ]
        
        for key in trend_keys:
            if key in features:
                summary[key] = features[key]
        
        # Add stability score (inverse of total variance)
        total_variance = sum(
            features.get(k, 0.0) for k in features 
            if k.startswith('variance_')
        )
        summary['stability_score'] = 1.0 / (1.0 + total_variance)
        
        return summary
    
    def get_weights(self) -> Dict[str, Any]:
        """Get model weights for federated averaging."""
        return {
            'feature_means': dict(self.feature_means),
            'feature_vars': dict(self.feature_vars),
            'feature_counts': dict(self.feature_counts),
            'projection_weights': (
                self.projection_weights.tolist() if NUMPY_AVAILABLE
                else self.projection_weights
            ),
            'step_count': self.step_count
        }
    
    def set_weights(self, weights: Dict[str, Any]) -> None:
        """Set model weights from federated aggregate."""
        if 'feature_means' in weights:
            self.feature_means = weights['feature_means']
        if 'feature_vars' in weights:
            self.feature_vars = weights['feature_vars']
        if 'feature_counts' in weights:
            self.feature_counts = weights['feature_counts']
        if 'projection_weights' in weights:
            if NUMPY_AVAILABLE:
                self.projection_weights = np.array(weights['projection_weights'])
            else:
                self.projection_weights = weights['projection_weights']
        if 'step_count' in weights:
            self.step_count = weights['step_count']


# =============================================================================
# SECTION 7: FEDERATED LEARNING LOGIC
# =============================================================================

class FederatedClient:
    """
    Handles federated learning communication with the aggregator server.
    Sends only model weights/embeddings, never raw metrics.
    Compatible with FedAvg protocol.
    """
    
    def __init__(self, endpoint: str = Config.AGGREGATOR_ENDPOINT,
                 client_id: str = Config.CLIENT_ID):
        self.endpoint = endpoint
        self.client_id = client_id or self._generate_client_id()
        self.last_update_time = 0
        self.update_count = 0
    
    def _generate_client_id(self) -> str:
        """Generate a unique client ID based on system characteristics."""
        try:
            # Use hostname and MAC address for uniqueness
            import socket
            hostname = socket.gethostname()
            
            # Get first MAC address
            mac = ""
            try:
                if PSUTIL_AVAILABLE:
                    for iface, addrs in psutil.net_if_addrs().items():
                        for addr in addrs:
                            if addr.family.name == 'AF_LINK':
                                mac = addr.address
                                break
                        if mac:
                            break
            except Exception:
                pass
            
            unique_str = f"{hostname}:{mac}:{time.time()}"
            return hashlib.sha256(unique_str.encode()).hexdigest()[:16]
        except Exception:
            return f"client_{int(time.time())}"
    
    def should_send_update(self, interval: int = Config.FEDERATED_UPDATE_INTERVAL_SEC) -> bool:
        """Check if it's time to send a federated update."""
        return (time.time() - self.last_update_time) >= interval
    
    def send_update(self, model: TrendModel, latest_embedding: List[float]) -> bool:
        """
        Send federated update to the aggregator.
        Returns True if successful, False otherwise.
        """
        if not REQUESTS_AVAILABLE:
            logger.debug("Requests library not available, skipping federated update")
            return False
        
        try:
            # Prepare FedAvg-compatible payload
            payload = {
                'client_id': self.client_id,
                'timestamp': time.time(),
                'update_count': self.update_count,
                'weights': model.get_weights(),
                'embedding': latest_embedding,
                'num_samples': model.step_count
            }
            
            # Sign the payload for integrity
            payload_json = json.dumps(payload, sort_keys=True)
            payload['signature'] = hashlib.sha256(payload_json.encode()).hexdigest()[:16]
            
            # Send to aggregator with retry logic
            for attempt in range(Config.MAX_RETRIES):
                try:
                    response = requests.post(
                        self.endpoint,
                        json=payload,
                        timeout=30,
                        headers={'Content-Type': 'application/json'}
                    )
                    
                    if response.status_code == 200:
                        self.last_update_time = time.time()
                        self.update_count += 1
                        logger.info(f"Federated update {self.update_count} sent successfully")
                        
                        # Check for aggregated weights in response
                        try:
                            resp_data = response.json()
                            if 'aggregated_weights' in resp_data:
                                model.set_weights(resp_data['aggregated_weights'])
                                logger.info("Received and applied aggregated weights")
                        except Exception:
                            pass
                        
                        return True
                    else:
                        logger.warning(
                            f"Federated update failed (attempt {attempt + 1}): "
                            f"HTTP {response.status_code}"
                        )
                except requests.exceptions.Timeout:
                    logger.warning(f"Federated update timeout (attempt {attempt + 1})")
                except requests.exceptions.ConnectionError:
                    logger.debug(f"Aggregator not reachable (attempt {attempt + 1})")
                
                if attempt < Config.MAX_RETRIES - 1:
                    time.sleep(Config.RETRY_DELAY_SEC)
            
            return False
            
        except Exception as e:
            logger.error(f"Federated update error: {e}")
            return False


# =============================================================================
# SECTION 8: MAIN LOOP
# =============================================================================

class FederatedAgent:
    """
    Main agent that orchestrates all components:
    - Metric collection
    - Sliding window management
    - Feature engineering
    - Local model updates
    - Federated learning updates
    """
    
    def __init__(self):
        self.collector = MetricCollector()
        self.buffer = SlidingWindowBuffer()
        self.feature_engineer = FeatureEngineer()
        self.model = TrendModel()
        self.federated_client = FederatedClient()
        
        self.running = True
        self.collection_count = 0
        self.latest_embedding: List[float] = []
    
    def run(self) -> None:
        """Main execution loop."""
        logger.info("=" * 60)
        logger.info("Federated Learning Client Starting")
        logger.info(f"Client ID: {self.federated_client.client_id}")
        logger.info(f"Collection interval: {Config.COLLECTION_INTERVAL_SEC}s")
        logger.info(f"Window size: {Config.SLIDING_WINDOW_MINUTES} minutes")
        logger.info(f"Federated update interval: {Config.FEDERATED_UPDATE_INTERVAL_SEC}s")
        logger.info("=" * 60)
        
        while self.running:
            try:
                self._iteration()
            except KeyboardInterrupt:
                logger.info("Shutdown requested, exiting gracefully...")
                self.running = False
            except Exception as e:
                logger.error(f"Iteration error: {e}")
                # Continue running, don't crash
            
            # Sleep until next collection
            try:
                time.sleep(Config.COLLECTION_INTERVAL_SEC)
            except KeyboardInterrupt:
                self.running = False
        
        logger.info("Federated Learning Client stopped")
    
    def _iteration(self) -> None:
        """Single iteration of the main loop."""
        self.collection_count += 1
        
        # Step 1: Collect metrics
        try:
            metrics = self.collector.collect_all()
            self.buffer.add(metrics)
        except Exception as e:
            logger.debug(f"Metric collection failed: {e}")
            return
        
        # Step 2: Feature engineering (need enough samples)
        if self.buffer.size() < 3:
            logger.debug(f"Warming up... ({self.buffer.size()} samples)")
            return
        
        try:
            features = self.feature_engineer.extract_features(self.buffer)
        except Exception as e:
            logger.debug(f"Feature engineering failed: {e}")
            features = {}
        
        # Step 3: Update local model
        try:
            result = self.model.update(features)
            self.latest_embedding = result.get('embedding', [])
        except Exception as e:
            logger.debug(f"Model update failed: {e}")
        
        # Step 4: Periodic status log
        if self.collection_count % 10 == 0:
            logger.info(
                f"Step {self.collection_count}: "
                f"buffer_size={self.buffer.size()}, "
                f"model_steps={self.model.step_count}"
            )
        
        # Step 5: Federated update (if interval elapsed)
        if self.federated_client.should_send_update():
            try:
                self.federated_client.send_update(self.model, self.latest_embedding)
            except Exception as e:
                logger.debug(f"Federated update failed: {e}")
    
    def stop(self) -> None:
        """Stop the agent gracefully."""
        self.running = False


# =============================================================================
# SECTION 9: ENTRY POINT
# =============================================================================

def main():
    """Entry point for the federated learning client."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Federated Learning Client for System Monitoring'
    )
    parser.add_argument(
        '--interval', type=int, default=Config.COLLECTION_INTERVAL_SEC,
        help='Metric collection interval in seconds'
    )
    parser.add_argument(
        '--window', type=int, default=Config.SLIDING_WINDOW_MINUTES,
        help='Sliding window size in minutes'
    )
    parser.add_argument(
        '--endpoint', type=str, default=Config.AGGREGATOR_ENDPOINT,
        help='Federated aggregator endpoint URL'
    )
    parser.add_argument(
        '--federated-interval', type=int, 
        default=Config.FEDERATED_UPDATE_INTERVAL_SEC,
        help='Federated update interval in seconds'
    )
    parser.add_argument(
        '--debug', action='store_true',
        help='Enable debug logging'
    )
    
    args = parser.parse_args()
    
    # Apply configuration overrides
    Config.COLLECTION_INTERVAL_SEC = args.interval
    Config.SLIDING_WINDOW_MINUTES = args.window
    Config.AGGREGATOR_ENDPOINT = args.endpoint
    Config.FEDERATED_UPDATE_INTERVAL_SEC = args.federated_interval
    
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Run the agent
    agent = FederatedAgent()
    
    try:
        agent.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())
