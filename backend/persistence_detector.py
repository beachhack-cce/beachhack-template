#!/usr/bin/env python3
"""
Automated Persistence Detector with Pattern Learning
Runs every 24 hours, learns patterns, and reclassifies threats
"""

import pandas as pd
import json
import os
from datetime import datetime, timedelta
import hashlib
from pathlib import Path
import schedule
import time
import math

def _clean_nans(obj):
    # Pandas Timestamp → string
    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()

    # NaN → None
    if isinstance(obj, float) and math.isnan(obj):
        return None

    # Dict
    if isinstance(obj, dict):
        return {k: _clean_nans(v) for k, v in obj.items()}

    # List
    if isinstance(obj, list):
        return [_clean_nans(i) for i in obj]

    return obj

class PersistenceDetector:
    def __init__(self, patterns_db='patterns_database.json', config_file='config.json'):
        self.patterns_db = patterns_db
        self.config_file = config_file
        self.detections_log = 'detections_history.json'
        
        # Load or initialize pattern database
        self.patterns = self._load_patterns()
        self.config = self._load_config()
        
        # Known MITRE ATT&CK patterns (seed patterns)
        self._initialize_base_patterns()
    
    def _load_patterns(self):
        """Load existing pattern database"""
        if os.path.exists(self.patterns_db):
            with open(self.patterns_db, 'r') as f:
                patterns = json.load(f)
            print(f"[+] Loaded {len(patterns)} patterns from database")
            return patterns
        else:
            print("[*] No existing pattern database found, will create new one")
            return {}
    
    def _save_patterns(self):
        
        """Save patterns to database"""
        self.patterns = _clean_nans(self.patterns)
        with open(self.patterns_db, 'w') as f:
            json.dump(self.patterns, f, indent=2)
        print(f"[+] Saved {len(self.patterns)} patterns to database")
    
    def _load_config(self):
        """Load configuration"""
        default_config = {
            'wazuh_api_url': 'https://localhost:55000',
            'wazuh_user': 'wazuh',
            'wazuh_pass': 'wazuh',
            'alert_export_path': 'daily_alerts.csv',
            'learning_threshold': 0.75,  # Confidence threshold to learn new patterns
            'detection_output': 'critical_alerts.json',
            'run_interval_hours': 24
        }
        
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r') as f:
                config = json.load(f)
            print("[+] Loaded configuration")
            return {**default_config, **config}
        else:
            with open(self.config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            print("[+] Created default configuration file")
            return default_config
    
    def _initialize_base_patterns(self):
        """Initialize with known MITRE ATT&CK persistence techniques"""
        base_patterns = {
            'T1547.001_registry_run': {
                'name': 'Registry Run Keys Persistence',
                'mitre_id': 'T1547.001',
                'severity': 'CRITICAL',
                'sequence': [
                    {'rule_id': '553', 'event_type': 'file_create'},
                    {'rule_id': '18101', 'event_type': 'registry_modify', 
                     'registry_contains': ['Run', 'RunOnce', 'CurrentVersion\\Run']}
                ],
                'correlation': 'file_path_in_registry_value',
                'time_window_minutes': 30,
                'confidence_base': 0.8,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            },
            
            'T1053.005_scheduled_task': {
                'name': 'Scheduled Task/Job - Scheduled Task',
                'mitre_id': 'T1053.005',
                'severity': 'CRITICAL',
                'sequence': [
                    {'rule_id': '553', 'event_type': 'file_create'},
                    {'process_name': 'schtasks.exe'},
                    {'rule_id': '60120', 'event_type': 'task_created'}
                ],
                'correlation': 'file_path_in_command_line',
                'time_window_minutes': 15,
                'confidence_base': 0.85,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            },
            
            'T1546.003_wmi_event': {
                'name': 'Event Triggered Execution - WMI Event Subscription',
                'mitre_id': 'T1546.003',
                'severity': 'CRITICAL',
                'sequence': [
                    {'process_name': 'wmic.exe'},
                    {'rule_id': '61600', 'event_type': 'wmi_filter'},
                    {'rule_id': '61601', 'event_type': 'wmi_consumer'}
                ],
                'time_window_minutes': 20,
                'confidence_base': 0.9,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            },
            
            'T1547.001_startup_folder': {
                'name': 'Boot or Logon Autostart - Startup Folder',
                'mitre_id': 'T1547.001',
                'severity': 'HIGH',
                'sequence': [
                    {'rule_id': '553', 'event_type': 'file_create',
                     'path_contains': ['Startup', 'Start Menu\\Programs\\Startup']}
                ],
                'time_window_minutes': 10,
                'confidence_base': 0.7,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            },
            
            'T1547.009_shortcut_modification': {
                'name': 'Boot or Logon Autostart - Shortcut Modification',
                'mitre_id': 'T1547.009',
                'severity': 'HIGH',
                'sequence': [
                    {'rule_id': '550', 'event_type': 'file_modify',
                     'file_extension': ['.lnk']},
                    {'path_contains': ['Desktop', 'Start Menu', 'Quick Launch']}
                ],
                'time_window_minutes': 15,
                'confidence_base': 0.65,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            },
            
            'T1543.003_windows_service': {
                'name': 'Create or Modify System Process - Windows Service',
                'mitre_id': 'T1543.003',
                'severity': 'CRITICAL',
                'sequence': [
                    {'rule_id': '553', 'event_type': 'file_create'},
                    {'rule_id': '60200', 'event_type': 'service_installed'},
                    {'rule_id': '60204', 'event_type': 'service_started'}
                ],
                'correlation': 'file_path_in_service_path',
                'time_window_minutes': 20,
                'confidence_base': 0.85,
                'detection_count': 0,
                'false_positive_count': 0,
                'last_seen': None
            }
        }
        
        # Merge with existing patterns (don't overwrite learned patterns)
        for pattern_id, pattern_def in base_patterns.items():
            if pattern_id not in self.patterns:
                self.patterns[pattern_id] = pattern_def
        
        self._save_patterns()
    
    def export_wazuh_alerts(self, hours=24):
        """Export LOW severity alerts from Wazuh"""
        print(f"\n[*] Exporting Wazuh alerts from last {hours} hours...")
        
        try:
            import requests
            import urllib3
            urllib3.disable_warnings()
            
            url = f"{self.config['wazuh_api_url']}/security/events"
            params = {
                'level': '0-6',  # LOW severity only
                'limit': 10000,
                'sort': '-timestamp'
            }
            
            response = requests.get(
                url,
                params=params,
                auth=(self.config['wazuh_user'], self.config['wazuh_pass']),
                verify=False,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                alerts = data['data']['items']
                
                # Convert to DataFrame
                df = self._flatten_alerts(alerts)
                
                # Save to CSV
                output_path = self.config['alert_export_path']
                df.to_csv(output_path, index=False)
                
                print(f"[+] Exported {len(df)} LOW severity alerts to {output_path}")
                return df
            else:
                print(f"[!] Error exporting alerts: HTTP {response.status_code}")
                return None
                
        except Exception as e:
            print(f"[!] Error connecting to Wazuh: {e}")
            print("[*] Attempting to load from existing CSV...")
            
            # Fallback: try to load existing CSV
            if os.path.exists(self.config['alert_export_path']):
                return pd.read_csv(self.config['alert_export_path'])
            return None
    
    def _flatten_alerts(self, alerts):
        """Convert nested JSON alerts to flat DataFrame"""
        flattened = []
        
        for alert in alerts:
            # Extract relevant fields
            flat = {
                'timestamp': alert.get('timestamp'),
                'agent_name': alert.get('agent', {}).get('name'),
                'agent_ip': alert.get('agent', {}).get('ip'),
                'user': None,
                'rule_id': alert.get('rule', {}).get('id'),
                'rule_level': alert.get('rule', {}).get('level'),
                'rule_description': alert.get('rule', {}).get('description'),
                'rule_mitre_id': None,
                'rule_mitre_tactic': None,
                'file_path': None,
                'process_name': None,
                'process_cmdline': None,
                'registry_key': None,
                'registry_value': None,
                'parent_process': None
            }
            
            # Extract MITRE ATT&CK info
            mitre = alert.get('rule', {}).get('mitre', {})
            if mitre:
                flat['rule_mitre_id'] = mitre.get('id', [None])[0] if isinstance(mitre.get('id'), list) else mitre.get('id')
                flat['rule_mitre_tactic'] = mitre.get('tactic', [None])[0] if isinstance(mitre.get('tactic'), list) else mitre.get('tactic')
            
            # Extract event data (Windows events)
            win_data = alert.get('data', {}).get('win', {}).get('eventdata', {})
            if win_data:
                flat['user'] = win_data.get('user') or win_data.get('SubjectUserName')
                flat['file_path'] = win_data.get('targetFilename') or win_data.get('image')
                flat['process_name'] = win_data.get('image', '').split('\\')[-1] if win_data.get('image') else None
                flat['process_cmdline'] = win_data.get('commandLine')
                flat['registry_key'] = win_data.get('targetObject')
                flat['registry_value'] = win_data.get('details')
                flat['parent_process'] = win_data.get('parentImage', '').split('\\')[-1] if win_data.get('parentImage') else None
            
            # Extract Syscheck data (file integrity monitoring)
            syscheck = alert.get('syscheck', {})
            if syscheck:
                flat['file_path'] = syscheck.get('path')
            
            flattened.append(flat)
        
        return pd.DataFrame(flattened)
    
    def analyze_daily_alerts(self, csv_file=None):
        """Main analysis function - runs daily"""
        print("\n" + "="*70)
        print("DAILY PERSISTENCE DETECTION ANALYSIS")
        print(f"Run Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*70)
        
        # Load alerts
        if csv_file:
            df = pd.read_csv(csv_file)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
        else:
            df = self.export_wazuh_alerts(hours=self.config['run_interval_hours'])
        
        if df is None or len(df) == 0:
            print("[!] No alerts to analyze")
            return []
        
        print(f"\n[+] Loaded {len(df)} LOW severity alerts")
        print(f"[+] Time range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        print(f"[+] Unique agents: {df['agent_name'].nunique()}")
        print(f"[+] Using {len(self.patterns)} detection patterns")
        
        # Detect threats
        all_detections = []
        
        for pattern_id, pattern_def in self.patterns.items():
            detections = self._detect_pattern(df, pattern_id, pattern_def)
            
            if detections:
                print(f"\n[!] {pattern_def['name']}: {len(detections)} detections")
                all_detections.extend(detections)
        
        # Reclassify and save
        if all_detections:
            print(f"\n{'='*70}")
            print(f"[!] TOTAL: {len(all_detections)} PERSISTENCE ATTACKS DETECTED")
            print(f"{'='*70}")
            
            self._reclassify_threats(all_detections)
            self._save_detections(all_detections)
            self._learn_new_patterns(all_detections, df)
        else:
            print(f"\n[+] No persistence attacks detected in this period")
        
        return all_detections
    
    def _detect_pattern(self, df, pattern_id, pattern_def):
        """Detect specific pattern in alerts"""
        detections = []
        
        # Group by agent and user
        for (agent, user), group in df.groupby(['agent_name', 'user']):
            if not agent or pd.isna(agent):
                continue
            
            # Sort by time
            group = group.sort_values('timestamp').reset_index(drop=True)
            
            # Sliding window search
            for i in range(len(group)):
                window_end = group.iloc[i]['timestamp'] + timedelta(
                    minutes=pattern_def['time_window_minutes']
                )
                
                window_events = group[
                    (group['timestamp'] >= group.iloc[i]['timestamp']) &
                    (group['timestamp'] <= window_end)
                ]
                
                # Check pattern match
                match_result = self._match_sequence(window_events, pattern_def)
                
                if match_result['matched']:
                    # Calculate confidence
                    confidence = self._calculate_confidence(
                        window_events, 
                        pattern_def, 
                        match_result
                    )
                    
                    detection = {
                        'detection_id': self._generate_detection_id(window_events),
                        'pattern_id': pattern_id,
                        'pattern_name': pattern_def['name'],
                        'mitre_id': pattern_def['mitre_id'],
                        'original_severity': 'LOW',
                        'reclassified_severity': pattern_def['severity'],
                        'confidence': confidence,
                        'agent': agent,
                        'user': user if not pd.isna(user) else 'UNKNOWN',
                        'start_time': str(window_events.iloc[0]['timestamp']),
                        'end_time': str(window_events.iloc[-1]['timestamp']),
                        'duration_seconds': (
                            window_events.iloc[-1]['timestamp'] - 
                            window_events.iloc[0]['timestamp']
                        ).total_seconds(),
                        'event_count': len(window_events),
                        'events': window_events.to_dict('records'),
                        'detection_time': datetime.now().isoformat()
                    }
                    
                    detections.append(detection)
                    
                    # Update pattern statistics
                    self.patterns[pattern_id]['detection_count'] += 1
                    self.patterns[pattern_id]['last_seen'] = datetime.now().isoformat()
                    
                    break  # Found one for this agent/user combo
        
        return detections
    
    def _match_sequence(self, events, pattern_def):
        """Check if events match pattern sequence"""
        sequence = pattern_def['sequence']
        matched_indices = []
        
        for seq_item in sequence:
            found = False
            
            for idx, event in events.iterrows():
                # Check rule_id
                if 'rule_id' in seq_item:
                    if str(event['rule_id']) != str(seq_item['rule_id']):
                        continue
                
                # Check process name
                if "process_name" in seq_item:
                    if (
                        not event.get("process_name")
                        or not isinstance(event["process_name"], str)
                        or not isinstance(seq_item["process_name"], str)
                        or seq_item["process_name"].lower() not in event["process_name"].lower()
                     ):
                        continue
                
                # Check registry contains
                if "registry_contains" in seq_item:
                    if (
                        not event.get("registry_key")
                        or not isinstance(event["registry_key"], str)
                        or not any(keyword in event["registry_key"]
                                    for keyword in seq_item["registry_contains"])
                    ):
                        continue

                # Check path contains
                if "path_contains" in seq_item:
                    if (
                        not event.get("file_path")
                        or not isinstance(event["file_path"], str)
                        or not any(keyword in event["file_path"]
                                    for keyword in seq_item["path_contains"])
                    ):
                        continue


                # Check file extension
                if 'file_extension' in seq_item:
                    if not event['file_path']:
                        continue
                    if not any(str(event['file_path']).endswith(ext) 
                              for ext in seq_item['file_extension']):
                        continue
                
                # If we get here, this event matches this sequence item
                found = True
                matched_indices.append(idx)
                break
            
            if not found:
                return {'matched': False, 'matched_indices': []}
        
        # Check correlation if specified
        if 'correlation' in pattern_def:
            if not self._check_correlation(events, pattern_def['correlation'], matched_indices):
                return {'matched': False, 'matched_indices': matched_indices}
        
        return {'matched': True, 'matched_indices': matched_indices}
    
    def _check_correlation(self, events, correlation_type, matched_indices):
        """Check if matched events are correlated"""
        if correlation_type == 'file_path_in_registry_value':
            # Check if file from first event appears in registry value
            file_events = events[events['file_path'].notna()]
            registry_events = events[events['registry_value'].notna()]
            
            if len(file_events) == 0 or len(registry_events) == 0:
                return False
            
            file_path = file_events.iloc[0]['file_path']
            registry_value = registry_events.iloc[0]['registry_value']
            
            # Extract filename
            if file_path and registry_value:
                filename = str(file_path).split('\\')[-1]
                return filename in str(registry_value)
        
        elif correlation_type == 'file_path_in_command_line':
            file_events = events[events['file_path'].notna()]
            cmd_events = events[events['process_cmdline'].notna()]
            
            if len(file_events) == 0 or len(cmd_events) == 0:
                return False
            
            file_path = file_events.iloc[0]['file_path']
            cmdline = cmd_events.iloc[0]['process_cmdline']
            
            if file_path and cmdline:
                return str(file_path) in str(cmdline)
        
        elif correlation_type == 'file_path_in_service_path':
            file_events = events[events['file_path'].notna()]
            # Would need service path data - simplified for now
            return len(file_events) > 0
        
        return True  # No correlation check needed
    
    def _calculate_confidence(self, events, pattern_def, match_result):
        """Calculate detection confidence score"""
        confidence = pattern_def['confidence_base']
        
        # Adjust based on timing
        duration = (events.iloc[-1]['timestamp'] - events.iloc[0]['timestamp']).total_seconds()
        if duration < 60:  # Less than 1 minute - very suspicious
            confidence += 0.15
        elif duration < 300:  # Less than 5 minutes
            confidence += 0.10
        
        # Adjust based on suspicious paths
        suspicious_paths = ['Temp', 'Public', 'AppData\\Roaming', 'Downloads', 'ProgramData']
        for event in events.to_dict('records'):
            if event['file_path']:
                if any(susp in str(event['file_path']) for susp in suspicious_paths):
                    confidence += 0.05
                    break
        
        # Adjust based on unusual parent processes
        suspicious_parents = ['winword.exe', 'excel.exe', 'powerpnt.exe', 'outlook.exe', 
                             'acrobat.exe', 'chrome.exe', 'firefox.exe']
        for event in events.to_dict('records'):
            if event['parent_process']:
                if any(parent in str(event['parent_process']).lower() 
                      for parent in suspicious_parents):
                    confidence += 0.10
                    break
        
        # Adjust based on pattern history (if it's often detected, likely real)
        if pattern_def['detection_count'] > 0:
            false_positive_rate = (pattern_def['false_positive_count'] / 
                                  pattern_def['detection_count'])
            confidence *= (1 - false_positive_rate * 0.5)
        
        return min(confidence, 1.0)
    
    def _generate_detection_id(self, events):
        """Generate unique detection ID"""
        #detections = _clean_nans(detections)
        # Create hash from key event attributes
    
        hash_input = f"{events.iloc[0]['timestamp']}{events.iloc[0]['agent_name']}{events.iloc[0]['rule_id']}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:16]
    
    def _reclassify_threats(self, detections):
        """Reclassify LOW threats to CRITICAL/HIGH"""
        print(f"\n[*] Reclassifying {len(detections)} LOW threats...")
        
        for detection in detections:
            print(f"\n  [{detection['reclassified_severity']}] {detection['pattern_name']}")
            print(f"      Agent: {detection['agent']} | User: {detection['user']}")
            print(f"      Confidence: {detection['confidence']:.0%}")
            print(f"      Events: {detection['event_count']} LOW severity alerts")
            print(f"      → RECLASSIFIED TO: {detection['reclassified_severity']}")
    
    
    def _save_detections(self, detections):
        detections = _clean_nans(detections)

        """Save detections to output file"""

        output_path = self.config['detection_output']

    # 🔧 FIX: Convert pandas Timestamp → string
        for d in detections:
            for e in d["events"]:
                if "timestamp" in e:
                    e["timestamp"] = str(e["timestamp"])

    # Load existing detections
        if os.path.exists(self.detections_log):
            with open(self.detections_log, 'r') as f:
                history = json.load(f)
        else:
            history = []

    # Append new detections
        history.extend(detections)

    # Save updated history
        with open(self.detections_log, 'w') as f:
            json.dump(history, f, indent=2)

    # Save today's detections separately
        with open(output_path, 'w') as f:
            json.dump(detections, f, indent=2)

        print(f"\n[+] Saved {len(detections)} detections to {output_path}")
        print(f"[+] Updated detection history: {len(history)} total detections")
    
    def _learn_new_patterns(self, detections, df):
        """Learn new patterns from high-confidence detections"""
        print(f"\n[*] Analyzing detections for pattern learning...")
        
        learned = 0
        for detection in detections:
            # Only learn from high-confidence detections
            if detection['confidence'] >= self.config['learning_threshold']:
                # Check if this is a variation of an existing pattern
                if self._is_novel_pattern(detection):
                    new_pattern = self._extract_pattern(detection)
                    
                    if new_pattern:
                        pattern_id = f"LEARNED_{datetime.now().strftime('%Y%m%d')}_{learned}"
                        self.patterns[pattern_id] = new_pattern
                        learned += 1
                        
                        print(f"  [+] Learned new pattern: {new_pattern['name']}")
        
        if learned > 0:
            self._save_patterns()
            print(f"\n[+] Learned {learned} new patterns!")
        else:
            print(f"  [-] No new patterns learned this cycle")
    
    def _is_novel_pattern(self, detection):
        """Check if detection represents a novel pattern"""
        # Simple novelty check - could be more sophisticated
        pattern_id = detection['pattern_id']
        
        # If it's already a learned pattern, don't re-learn
        if pattern_id.startswith('LEARNED_'):
            return False
        
        # Check if we've seen this exact sequence before
        # (This is simplified - production would use sequence similarity)
        return True
    
    def _extract_pattern(self, detection):
        """Extract pattern definition from detection"""
        # Create a new pattern based on the detection
        events = detection['events']
        
        sequence = []
        for event in events:
            seq_item = {}
            
            if event['rule_id']:
                seq_item['rule_id'] = str(event['rule_id'])


            if (
                event.get("process_name") 
                and isinstance(event["process_name"], str)
            ):
                seq_item["process_name"] = event["process_name"]

                        
            if event.get("registry_key") and isinstance(event["registry_key"], str):
                # Extract common registry path parts
                key_parts = event['registry_key'].split('\\')
                if len(key_parts) > 2:
                    seq_item['registry_contains'] = [key_parts[-2]]
            
            if event.get("file_path") and isinstance(event["file_path"], str):
                # Extract path keywords
                if 'Startup' in event['file_path']:
                    seq_item['path_contains'] = ['Startup']
                elif 'Temp' in event['file_path']:
                    seq_item['path_contains'] = ['Temp']
            
            if seq_item:
                sequence.append(seq_item)
        
        if len(sequence) < 2:
            return None  # Need at least 2 events to form a pattern
        
        new_pattern = {
            'name': f"Learned Pattern - {detection['pattern_name']} Variant",
            'mitre_id': detection['mitre_id'],
            'severity': detection['reclassified_severity'],
            'sequence': sequence,
            'time_window_minutes': int(detection['duration_seconds'] / 60) + 5,
            'confidence_base': detection['confidence'] * 0.9,  # Slightly lower for learned patterns
            'detection_count': 1,
            'false_positive_count': 0,
            'last_seen': datetime.now().isoformat(),
            'learned_from': detection['detection_id'],
            'learned_date': datetime.now().isoformat()
        }
        
        return new_pattern
    
    def generate_analyst_report(self, detections):
        cleaned = _clean_nans(detections)

        json_report_path = f"analyst_report_{datetime.now().strftime('%Y%m%d')}.json"

        with open(json_report_path, "w") as jf:
            json.dump({
                "generated_at": datetime.now().isoformat(),
                "total_detections": len(cleaned),
                "detections": cleaned
            }, jf, indent=2)

        """Generate human-readable report for analysts"""

        # report_path = f"analyst_report_{datetime.now().strftime('%Y%m%d')}.txt"
        
        # with open(report_path, 'w', encoding="utf-8") as f:
        #     f.write("="*70 + "\n")
        #     f.write("DAILY PERSISTENCE DETECTION REPORT\n")
        #     f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        #     f.write("="*70 + "\n\n")
            
        #     if not detections:
        #         f.write("✅ No persistence attacks detected in the last 24 hours.\n")
        #         return report_path
            
        #     f.write(f"🚨 ALERT: {len(detections)} PERSISTENCE ATTACKS DETECTED\n\n")
            
        #     # Summary by severity
        #     critical = sum(1 for d in detections if d['reclassified_severity'] == 'CRITICAL')
        #     high = sum(1 for d in detections if d['reclassified_severity'] == 'HIGH')
            
        #     f.write("SEVERITY BREAKDOWN:\n")
        #     f.write(f"  CRITICAL: {critical}\n")
        #     f.write(f"  HIGH: {high}\n\n")
            
        #     # Detailed detections
        #     for i, det in enumerate(detections, 1):
        #         f.write(f"\n{'='*70}\n")
        #         f.write(f"DETECTION #{i}\n")
        #         f.write(f"{'='*70}\n\n")
                
        #         f.write(f"Threat Type: {det['pattern_name']}\n")
        #         f.write(f"MITRE ATT&CK: {det['mitre_id']}\n")
        #         f.write(f"Severity: {det['reclassified_severity']} (originally LOW)\n")
        #         f.write(f"Confidence: {det['confidence']:.0%}\n\n")
                
        #         f.write(f"Target System:\n")
        #         f.write(f"  Agent: {det['agent']}\n")
        #         f.write(f"  User: {det['user']}\n\n")
                
        #         f.write(f"Timeline:\n")
        #         f.write(f"  Start: {det['start_time']}\n")
        #         f.write(f"  End: {det['end_time']}\n")
        #         f.write(f"  Duration: {det['duration_seconds']:.1f} seconds\n\n")_idrule_description']}\n")
                    
        #             if event['file_path']:
        #                 f.write(f"    File: {event['file_path']}\n")
        #             if event['registry_key']:
        #                 f.write(f"    Registry: {event['registry_key']}\n")
        #             if event['process_name']:
        #                 f.write(f"    Process: {event['process_name']}\n")
        #             if event['process_cmdline']:
        #                 f.write(f"    Command: {event['process_cmdline']}\n")
                
        #         f.write("\n" + "-"*70 + "\n")
        #         f.write("RECOMMENDED ACTIONS:\n")
        #         f.write("  1. Isolate affected system immediately\n")
        #         f.write("  2. Investigate user account for compromise\n")
        #         f.write("  3. Check for lateral movement to other systems\n")
        #         f.write("  4. Remove persistence mechanism\n")
        #         f.write("  5. Conduct full forensic analysis\n")
        
        # print(f"\n[+] Analyst report saved to: {report_path}")
        # return report_path
    
    def run_daily(self):
        """Run the daily analysis cycle"""
        print("\n" + "🔍 "*20)
        print("Starting Daily Persistence Detection Cycle")
        print("🔍 "*20 + "\n")
        
        # Analyze
        detections = self.analyze_daily_alerts()
        
        # Generate report
        if detections:
            self.generate_analyst_report(detections)
            
            # Send alerts (placeholder - would integrate with alerting system)
            self._send_alerts(detections)
        
        print("\n" + "✅ "*20)
        print("Daily Analysis Complete")
        print("✅ "*20 + "\n")
    
    def _send_alerts(self, detections):
        """Send alerts to SOC (placeholder for integration)"""
        print(f"\n[*] Sending alerts for {len(detections)} detections...")
        
        # In production, this would:
        # - Send to SIEM
        # - Create tickets in ticketing system
        # - Send email/Slack notifications
        # - Update dashboard
        
        for detection in detections:
            print(f"  [ALERT] {detection['reclassified_severity']}: {detection['pattern_name']} on {detection['agent']}")
    
    def schedule_daily_run(self, run_time="02:00"):
        """Schedule daily runs"""
        print(f"[*] Scheduling daily runs at {run_time}...")
        
        schedule.every().day.at(run_time).do(self.run_daily)
        
        print(f"[+] Scheduled! Will run daily at {run_time}")
        print("[*] Press Ctrl+C to stop")
        
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Automated Persistence Detector')
    parser.add_argument('--csv', help='Analyze specific CSV file')
    parser.add_argument('--schedule', action='store_true', help='Run on 24-hour schedule')
    parser.add_argument('--time', default='02:00', help='Scheduled run time (HH:MM)')
    parser.add_argument('--export-only', action='store_true', help='Only export alerts, don\'t analyze')
    
    args = parser.parse_args()
    
    detector = PersistenceDetector()
    
    if args.export_only:
        detector.export_wazuh_alerts()
    elif args.schedule:
        detector.schedule_daily_run(run_time=args.time)
    else:
        # Run once
        detections = detector.analyze_daily_alerts(csv_file=args.csv)
        if detections:
            detector.generate_analyst_report(detections)


if __name__ == "__main__":
    main()
