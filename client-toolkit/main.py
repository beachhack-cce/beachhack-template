#!/usr/bin/env python3

import time
import json
import platform
import requests
import psutil
from pathlib import Path
from datetime import datetime
from typing import TypedDict, Optional
from dataclasses import dataclass

class ResourceMetrics(TypedDict):
    """Type definition for resource metrics."""
    timestamp: str
    system_id: str
    hostname: str
    system: str
    cpu: dict
    memory: dict
    disk: dict
    network: dict

@dataclass
class PreviousMetrics:
    """Store previous metrics for rate calculations."""
    timestamp: float
    disk_read_bytes: int
    disk_write_bytes: int
    net_bytes_sent: int
    net_bytes_recv: int
    mem_page_ins: Optional[int] = None
    mem_page_outs: Optional[int] = None

def load_config() -> dict:
    """Load configuration from ~/.paper/config file."""
    config_dir = Path.home() / ".paper"
    config_file = config_dir / "config.json"
    
    if not config_dir.exists():
      raise FileNotFoundError(f"Config directory not found: {config_dir}")
    
    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_file}")
    
    try:
        with open(config_file, "r") as f:
            config = json.load(f)
        return config
    except json.JSONDecodeError as e:
        raise ValueError(f"Error parsing config file: {e}")

# Load configuration
config = load_config()
API_ENDPOINT = config["api_endpoint"]
SYSTEM_ID = config["system_id"]
MONITOR_INTERVAL = config["monitor_interval"]
REQUEST_TIMEOUT = config["request_timeout"]

previous_metrics: Optional[PreviousMetrics] = None

def calculate_rate(current: int, previous: int, time_delta: float) -> float:
    """Calculate the rate per second."""
    if time_delta <= 0:
        return 0.0
    return (current - previous) / time_delta

def get_cpu_metrics() -> dict:
    """Collect CPU usage metrics."""
    return {
        "percent": psutil.cpu_percent(interval=1),
        "count": psutil.cpu_count(),
        "count_logical": psutil.cpu_count(logical=True),
        "frequency_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None,
    }

def get_memory_metrics() -> dict:
    """Collect memory usage metrics with swap I/O rates."""
    global previous_metrics
    
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    
    metrics = {
        "total_bytes": mem.total,
        "available_bytes": mem.available,
        "used_bytes": mem.used,
        "percent": mem.percent,
        "swap_total_bytes": swap.total,
        "swap_used_bytes": swap.used,
        "swap_percent": swap.percent,
    }
    
    try:
        swap_io = psutil.swap_memory()
        # sin = bytes swapped in from disk, sout = bytes swapped out to disk
        metrics["swap_in_bytes"] = getattr(swap_io, 'sin', 0)
        metrics["swap_out_bytes"] = getattr(swap_io, 'sout', 0)
        
        # Calculate swap rates if we have previous data
        if previous_metrics and previous_metrics.mem_page_ins is not None:
            time_delta = time.time() - previous_metrics.timestamp
            metrics["swap_in_bytes_per_sec"] = calculate_rate(
                metrics["swap_in_bytes"], previous_metrics.mem_page_ins, time_delta
            )
            metrics["swap_out_bytes_per_sec"] = calculate_rate(
                metrics["swap_out_bytes"], previous_metrics.mem_page_outs, time_delta
            )
        else:
            metrics["swap_in_bytes_per_sec"] = 0.0
            metrics["swap_out_bytes_per_sec"] = 0.0
    except AttributeError:
        pass
    
    return metrics

def get_disk_metrics() -> dict:
    """Collect disk usage metrics with I/O rates."""
    global previous_metrics
    
    disks = []
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            disks.append({
                "device": partition.device,
                "mountpoint": partition.mountpoint,
                "fstype": partition.fstype,
                "total_bytes": usage.total,
                "used_bytes": usage.used,
                "free_bytes": usage.free,
                "percent": usage.percent,
            })
        except PermissionError:
            continue
    
    io = psutil.disk_io_counters()
    current_read = io.read_bytes if io else 0
    current_write = io.write_bytes if io else 0
    
    io_metrics = {
        "read_bytes": current_read,
        "write_bytes": current_write,
        "read_count": io.read_count if io else 0,
        "write_count": io.write_count if io else 0,
    }
    
    # Calculate rates if we have previous data
    if previous_metrics:
        time_delta = time.time() - previous_metrics.timestamp
        io_metrics["read_bytes_per_sec"] = calculate_rate(
            current_read, previous_metrics.disk_read_bytes, time_delta
        )
        io_metrics["write_bytes_per_sec"] = calculate_rate(
            current_write, previous_metrics.disk_write_bytes, time_delta
        )
    else:
        io_metrics["read_bytes_per_sec"] = 0.0
        io_metrics["write_bytes_per_sec"] = 0.0
    
    return {
        "partitions": disks,
        "io": io_metrics,
    }

def get_network_metrics() -> dict:
    """Collect network usage metrics with transfer rates."""
    global previous_metrics
    
    io = psutil.net_io_counters()
    current_sent = io.bytes_sent
    current_recv = io.bytes_recv
    
    metrics = {
        "bytes_sent": current_sent,
        "bytes_recv": current_recv,
        "packets_sent": io.packets_sent,
        "packets_recv": io.packets_recv,
        "errors_in": io.errin,
        "errors_out": io.errout,
        "drops_in": io.dropin,
        "drops_out": io.dropout,
    }
    
    # Calculate rates if we have previous data
    if previous_metrics:
        time_delta = time.time() - previous_metrics.timestamp
        metrics["bytes_sent_per_sec"] = calculate_rate(
            current_sent, previous_metrics.net_bytes_sent, time_delta
        )
        metrics["bytes_recv_per_sec"] = calculate_rate(
            current_recv, previous_metrics.net_bytes_recv, time_delta
        )
    else:
        metrics["bytes_sent_per_sec"] = 0.0
        metrics["bytes_recv_per_sec"] = 0.0
    
    return metrics

def update_previous_metrics():
    """Update the stored previous metrics for next rate calculation."""
    global previous_metrics
    
    io_disk = psutil.disk_io_counters()
    io_net = psutil.net_io_counters()
    swap = psutil.swap_memory()
    
    previous_metrics = PreviousMetrics(
        timestamp=time.time(),
        disk_read_bytes=io_disk.read_bytes if io_disk else 0,
        disk_write_bytes=io_disk.write_bytes if io_disk else 0,
        net_bytes_sent=io_net.bytes_sent,
        net_bytes_recv=io_net.bytes_recv,
        mem_page_ins=getattr(swap, 'sin', None),
        mem_page_outs=getattr(swap, 'sout', None),
    )

def collect_metrics() -> ResourceMetrics:
    """Collect all system resource metrics."""
    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "system_id": SYSTEM_ID,
        "hostname": platform.node(),
        "system": f"{platform.system()} {platform.release()}",
        "cpu": get_cpu_metrics(),
        "memory": get_memory_metrics(),
        "disk": get_disk_metrics(),
        "network": get_network_metrics(),
    }

def send_metrics(metrics: ResourceMetrics) -> bool:
    """Send metrics to the remote API endpoint."""
    try:
        response = requests.post(
            API_ENDPOINT,
            json=metrics,
            timeout=REQUEST_TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        print(f"[{metrics['timestamp']}] Metrics sent successfully")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[{metrics['timestamp']}] Failed to send metrics: {e}")
        return False

def main():
    """Main monitoring loop."""
    global previous_metrics
    
    print(f"Starting resource monitor...")
    print(f"API Endpoint: {API_ENDPOINT}")
    print(f"Interval: {MONITOR_INTERVAL} seconds")
    print("-" * 50)
    
    # Initialize previous metrics on first run
    update_previous_metrics()
    time.sleep(1)  # Brief pause to get initial readings
    
    while True:
        try:
            metrics = collect_metrics()
            print(metrics)
            send_metrics(metrics)
            update_previous_metrics()
        except Exception as e:
            print(f"Error collecting metrics: {e}")
        
        time.sleep(MONITOR_INTERVAL)

if __name__ == "__main__":
    main()