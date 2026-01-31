#!/usr/bin/env python3
"""
Host-Level Security Event Monitor
Detects and logs security events with timestamps and exposes them via REST API
"""

import os
import sys
import json
import time
import threading
import hashlib
import pwd
import grp
import re
from datetime import datetime, timezone
from collections import deque
from pathlib import Path
from flask import Flask, jsonify, request
import psutil

# Configuration
EVENT_BUFFER_SIZE = 1000
MONITORED_PATHS = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/sudoers',
    '/etc/ssh/sshd_config',
    '/etc/hosts',
]

# Global event storage
events = deque(maxlen=EVENT_BUFFER_SIZE)
events_lock = threading.Lock()

# Flask app
app = Flask(__name__)

class SecurityEventMonitor:
    """Main security event monitoring class"""
    
    def __init__(self):
        self.running = False
        self.monitors = []
        self.file_hashes = {}
        self.known_processes = set()
        self.last_user_count = 0
        self.failed_login_pattern = re.compile(
            r'(Failed password|authentication failure|Invalid user)'
        )
        
    def log_event(self, event_type, severity, description, metadata=None):
        """Log a security event with structured data"""
        event = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event_type': event_type,
            'severity': severity,
            'description': description,
            'hostname': os.uname().nodename,
            'metadata': metadata or {}
        }
        
        with events_lock:
            events.append(event)
        
        # Also print to console
        print(f"[{event['timestamp']}] {severity.upper()}: {event_type} - {description}")
        
    def calculate_file_hash(self, filepath):
        """Calculate SHA256 hash of a file"""
        try:
            sha256_hash = hashlib.sha256()
            with open(filepath, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            return None
    
    def monitor_file_integrity(self):
        """Monitor critical system files for changes"""
        while self.running:
            try:
                for filepath in MONITORED_PATHS:
                    if not os.path.exists(filepath):
                        continue
                    
                    current_hash = self.calculate_file_hash(filepath)
                    if current_hash is None:
                        continue
                    
                    if filepath in self.file_hashes:
                        if self.file_hashes[filepath] != current_hash:
                            self.log_event(
                                event_type='FILE_INTEGRITY_VIOLATION',
                                severity='high',
                                description=f'Critical file modified: {filepath}',
                                metadata={
                                    'file': filepath,
                                    'old_hash': self.file_hashes[filepath],
                                    'new_hash': current_hash
                                }
                            )
                    
                    self.file_hashes[filepath] = current_hash
                
            except Exception as e:
                print(f"Error in file integrity monitor: {e}")
            
            time.sleep(5)
    
    def monitor_processes(self):
        """Monitor for suspicious process activity"""
        while self.running:
            try:
                current_processes = set()
                
                for proc in psutil.process_iter(['pid', 'name', 'username', 'cmdline']):
                    try:
                        proc_info = proc.info
                        proc_id = (proc_info['pid'], proc_info['name'])
                        current_processes.add(proc_id)
                        
                        # Detect new processes
                        if proc_id not in self.known_processes:
                            # Check for suspicious process names
                            suspicious_names = ['nc', 'ncat', 'netcat', 'bash', 'sh', 'python']
                            cmdline = ' '.join(proc_info.get('cmdline', []) or [])
                            
                            if any(susp in proc_info['name'].lower() for susp in suspicious_names):
                                if 'reverse' in cmdline.lower() or 'shell' in cmdline.lower():
                                    self.log_event(
                                        event_type='SUSPICIOUS_PROCESS',
                                        severity='critical',
                                        description=f'Potential reverse shell detected',
                                        metadata={
                                            'pid': proc_info['pid'],
                                            'name': proc_info['name'],
                                            'user': proc_info.get('username'),
                                            'cmdline': cmdline
                                        }
                                    )
                            
                            # Detect root processes
                            if proc_info.get('username') == 'root':
                                self.log_event(
                                    event_type='ROOT_PROCESS_STARTED',
                                    severity='medium',
                                    description=f'New root process: {proc_info["name"]}',
                                    metadata={
                                        'pid': proc_info['pid'],
                                        'name': proc_info['name'],
                                        'cmdline': cmdline
                                    }
                                )
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                
                self.known_processes = current_processes
                
            except Exception as e:
                print(f"Error in process monitor: {e}")
            
            time.sleep(3)
    
    def monitor_network_connections(self):
        """Monitor network connections for suspicious activity"""
        known_connections = set()
        
        while self.running:
            try:
                current_connections = set()
                
                for conn in psutil.net_connections(kind='inet'):
                    if conn.status == 'LISTEN':
                        conn_id = (conn.laddr.ip, conn.laddr.port)
                        current_connections.add(conn_id)
                        
                        # Detect new listening ports
                        if conn_id not in known_connections:
                            self.log_event(
                                event_type='NEW_LISTENING_PORT',
                                severity='medium',
                                description=f'New service listening on {conn.laddr.ip}:{conn.laddr.port}',
                                metadata={
                                    'ip': conn.laddr.ip,
                                    'port': conn.laddr.port,
                                    'pid': conn.pid
                                }
                            )
                
                known_connections = current_connections
                
            except Exception as e:
                print(f"Error in network monitor: {e}")
            
            time.sleep(10)
    
    def monitor_user_accounts(self):
        """Monitor user account changes"""
        while self.running:
            try:
                # Count users
                users = pwd.getpwall()
                current_count = len(users)
                
                if self.last_user_count > 0 and current_count != self.last_user_count:
                    if current_count > self.last_user_count:
                        self.log_event(
                            event_type='USER_ACCOUNT_CREATED',
                            severity='high',
                            description='New user account detected',
                            metadata={
                                'user_count': current_count,
                                'previous_count': self.last_user_count
                            }
                        )
                    else:
                        self.log_event(
                            event_type='USER_ACCOUNT_DELETED',
                            severity='high',
                            description='User account removed',
                            metadata={
                                'user_count': current_count,
                                'previous_count': self.last_user_count
                            }
                        )
                
                self.last_user_count = current_count
                
            except Exception as e:
                print(f"Error in user account monitor: {e}")
            
            time.sleep(15)
    
    def monitor_auth_logs(self):
        """Monitor authentication logs for failed logins"""
        auth_log_paths = ['/var/log/auth.log', '/var/log/secure']
        log_path = None
        
        for path in auth_log_paths:
            if os.path.exists(path):
                log_path = path
                break
        
        if not log_path:
            print("No auth log found, skipping auth log monitoring")
            return
        
        # Keep track of file position
        try:
            with open(log_path, 'r') as f:
                f.seek(0, 2)  # Go to end of file
                file_pos = f.tell()
        except PermissionError:
            print(f"Permission denied reading {log_path}, skipping auth log monitoring")
            return
        
        while self.running:
            try:
                with open(log_path, 'r') as f:
                    f.seek(file_pos)
                    new_lines = f.readlines()
                    file_pos = f.tell()
                    
                    for line in new_lines:
                        if self.failed_login_pattern.search(line):
                            self.log_event(
                                event_type='FAILED_LOGIN_ATTEMPT',
                                severity='medium',
                                description='Failed login attempt detected',
                                metadata={
                                    'log_entry': line.strip()
                                }
                            )
                        
                        if 'sudo' in line.lower() and 'command' in line.lower():
                            self.log_event(
                                event_type='SUDO_COMMAND_EXECUTED',
                                severity='low',
                                description='Sudo command executed',
                                metadata={
                                    'log_entry': line.strip()
                                }
                            )
            except Exception as e:
                print(f"Error reading auth log: {e}")
            
            time.sleep(2)
    
    def start(self):
        """Start all monitoring threads"""
        self.running = True
        
        # Initialize file hashes
        for filepath in MONITORED_PATHS:
            if os.path.exists(filepath):
                self.file_hashes[filepath] = self.calculate_file_hash(filepath)
        
        # Initialize user count
        self.last_user_count = len(pwd.getpwall())
        
        # Initialize known processes
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                self.known_processes.add((proc.info['pid'], proc.info['name']))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        # Start monitoring threads
        monitors = [
            threading.Thread(target=self.monitor_file_integrity, daemon=True),
            threading.Thread(target=self.monitor_processes, daemon=True),
            threading.Thread(target=self.monitor_network_connections, daemon=True),
            threading.Thread(target=self.monitor_user_accounts, daemon=True),
            threading.Thread(target=self.monitor_auth_logs, daemon=True),
        ]
        
        for monitor in monitors:
            monitor.start()
            self.monitors.append(monitor)
        
        self.log_event(
            event_type='MONITOR_STARTED',
            severity='info',
            description='Security monitoring started',
            metadata={
                'monitored_files': len(MONITORED_PATHS),
                'monitored_paths': MONITORED_PATHS
            }
        )
    
    def stop(self):
        """Stop all monitoring"""
        self.running = False
        self.log_event(
            event_type='MONITOR_STOPPED',
            severity='info',
            description='Security monitoring stopped'
        )

# Initialize monitor
monitor = SecurityEventMonitor()

# REST API Endpoints
@app.route('/api/events', methods=['GET'])
def get_events():
    """Get all security events"""
    with events_lock:
        return jsonify({
            'total_events': len(events),
            'events': list(events)
        })

@app.route('/api/events/recent', methods=['GET'])
def get_recent_events():
    """Get recent security events"""
    limit = request.args.get('limit', default=50, type=int)
    limit = min(limit, EVENT_BUFFER_SIZE)
    
    with events_lock:
        recent = list(events)[-limit:]
    
    return jsonify({
        'count': len(recent),
        'events': recent
    })

@app.route('/api/events/severity/<severity>', methods=['GET'])
def get_events_by_severity(severity):
    """Get events by severity level"""
    with events_lock:
        filtered = [e for e in events if e['severity'] == severity.lower()]
    
    return jsonify({
        'severity': severity,
        'count': len(filtered),
        'events': filtered
    })

@app.route('/api/events/type/<event_type>', methods=['GET'])
def get_events_by_type(event_type):
    """Get events by type"""
    with events_lock:
        filtered = [e for e in events if e['event_type'] == event_type.upper()]
    
    return jsonify({
        'event_type': event_type,
        'count': len(filtered),
        'events': filtered
    })

@app.route('/api/events/search', methods=['GET'])
def search_events():
    """Search events by keyword"""
    query = request.args.get('q', '')
    
    with events_lock:
        filtered = [
            e for e in events 
            if query.lower() in json.dumps(e).lower()
        ]
    
    return jsonify({
        'query': query,
        'count': len(filtered),
        'events': filtered
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get statistics about security events"""
    with events_lock:
        event_list = list(events)
    
    stats = {
        'total_events': len(event_list),
        'by_severity': {},
        'by_type': {},
        'recent_critical': []
    }
    
    for event in event_list:
        # Count by severity
        severity = event['severity']
        stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
        
        # Count by type
        event_type = event['event_type']
        stats['by_type'][event_type] = stats['by_type'].get(event_type, 0) + 1
        
        # Collect critical events
        if severity == 'critical':
            stats['recent_critical'].append(event)
    
    # Keep only last 10 critical events
    stats['recent_critical'] = stats['recent_critical'][-10:]
    
    return jsonify(stats)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'monitor_active': monitor.running,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

@app.route('/api/clear', methods=['POST'])
def clear_events():
    """Clear all events (use with caution)"""
    with events_lock:
        events.clear()
    
    return jsonify({
        'status': 'cleared',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

def main():
    """Main entry point"""
    print("=" * 60)
    print("Host-Level Security Event Monitor")
    print("=" * 60)
    print()
    
    # Start monitoring
    monitor.start()
    
    print("\nAPI Server starting on http://0.0.0.0:5000")
    print("\nAvailable endpoints:")
    print("  GET  /api/events              - Get all events")
    print("  GET  /api/events/recent       - Get recent events (limit parameter)")
    print("  GET  /api/events/severity/<s> - Get events by severity")
    print("  GET  /api/events/type/<type>  - Get events by type")
    print("  GET  /api/events/search?q=    - Search events")
    print("  GET  /api/stats               - Get event statistics")
    print("  GET  /api/health              - Health check")
    print("  POST /api/clear               - Clear all events")
    print("\nPress Ctrl+C to stop")
    print()
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        print("\n\nStopping security monitor...")
        monitor.stop()
        print("Stopped.")

if __name__ == '__main__':
    main()
