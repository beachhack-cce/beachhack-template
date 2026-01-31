#!/usr/bin/env python3
"""
Requestly Integration - Attack Pattern Injector
Injects simulated attack patterns into Wazuh alert CSV for testing persistence detector
"""

import pandas as pd
import json
from datetime import datetime, timedelta
import random

class AttackInjector:
    """Inject MITRE ATT&CK patterns into CSV for testing"""
    
    def __init__(self):
        self.attack_templates = {
            'T1547.001_registry': {
                'name': 'Registry Run Keys Persistence',
                'mitre_id': 'T1547.001',
                'events': [
                    {
                        'rule.id': '553',
                        'rule.level': '3',
                        'rule.description': 'Integrity checksum changed',
                        'agent.name': 'requestly-test-01',
                        'data.win.eventdata.targetFilename': 'C:\\Users\\victim\\AppData\\Roaming\\malware.exe',
                        'decoder.name': 'sysmon',
                        'full_log': 'File created: malware.exe'
                    },
                    {
                        'rule.id': '18101',
                        'rule.level': '3',
                        'rule.description': 'Registry value set',
                        'agent.name': 'requestly-test-01',
                        'data.win.eventdata.targetObject': 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\EvilStartup',
                        'data.win.eventdata.details': 'C:\\Users\\victim\\AppData\\Roaming\\malware.exe',
                        'decoder.name': 'sysmon',
                        'full_log': 'Registry Run key modified'
                    }
                ]
            },
            
            'T1053.005_scheduled_task': {
                'name': 'Scheduled Task Persistence',
                'mitre_id': 'T1053.005',
                'events': [
                    {
                        'rule.id': '553',
                        'rule.level': '3',
                        'rule.description': 'File created',
                        'agent.name': 'requestly-test-02',
                        'data.win.eventdata.targetFilename': 'C:\\Windows\\Temp\\backdoor.exe',
                        'decoder.name': 'sysmon',
                        'full_log': 'Suspicious file created in Temp'
                    },
                    {
                        'rule.id': '60120',
                        'rule.level': '3',
                        'rule.description': 'Scheduled task created',
                        'agent.name': 'requestly-test-02',
                        'data.win.eventdata.processName': 'schtasks.exe',
                        'data.win.eventdata.commandLine': '/create /tn EvilTask /tr C:\\Windows\\Temp\\backdoor.exe',
                        'decoder.name': 'windows',
                        'full_log': 'Scheduled task created via schtasks.exe'
                    }
                ]
            },
            
            'T1546.003_wmi_event': {
                'name': 'WMI Event Subscription',
                'mitre_id': 'T1546.003',
                'events': [
                    {
                        'rule.id': '61600',
                        'rule.level': '3',
                        'rule.description': 'WMI filter created',
                        'agent.name': 'requestly-test-03',
                        'data.win.eventdata.processName': 'wmic.exe',
                        'data.win.eventdata.commandLine': 'wmic /namespace:\\\\root\\subscription PATH __EventFilter CREATE',
                        'decoder.name': 'windows',
                        'full_log': 'WMI event filter created'
                    },
                    {
                        'rule.id': '61601',
                        'rule.level': '3',
                        'rule.description': 'WMI consumer created',
                        'agent.name': 'requestly-test-03',
                        'data.win.eventdata.processName': 'wmic.exe',
                        'data.win.eventdata.commandLine': 'wmic /namespace:\\\\root\\subscription PATH CommandLineEventConsumer',
                        'decoder.name': 'windows',
                        'full_log': 'WMI consumer created'
                    }
                ]
            },
            
            'T1547.001_startup_folder': {
                'name': 'Startup Folder Persistence',
                'mitre_id': 'T1547.001',
                'events': [
                    {
                        'rule.id': '553',
                        'rule.level': '3',
                        'rule.description': 'File created',
                        'agent.name': 'requestly-test-04',
                        'data.win.eventdata.targetFilename': 'C:\\Users\\victim\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\evil.exe',
                        'decoder.name': 'sysmon',
                        'full_log': 'File created in Startup folder'
                    }
                ]
            },
            
            'T1543.003_windows_service': {
                'name': 'Windows Service Creation',
                'mitre_id': 'T1543.003',
                'events': [
                    {
                        'rule.id': '553',
                        'rule.level': '3',
                        'rule.description': 'File created',
                        'agent.name': 'requestly-test-05',
                        'data.win.eventdata.targetFilename': 'C:\\Windows\\System32\\malicious_service.exe',
                        'decoder.name': 'sysmon',
                        'full_log': 'Suspicious service binary created'
                    },
                    {
                        'rule.id': '60200',
                        'rule.level': '3',
                        'rule.description': 'Windows service installed',
                        'agent.name': 'requestly-test-05',
                        'data.win.eventdata.serviceName': 'EvilService',
                        'data.win.eventdata.imagePath': 'C:\\Windows\\System32\\malicious_service.exe',
                        'decoder.name': 'windows',
                        'full_log': 'Service installed'
                    },
                    {
                        'rule.id': '60204',
                        'rule.level': '3',
                        'rule.description': 'Windows service started',
                        'agent.name': 'requestly-test-05',
                        'data.win.eventdata.serviceName': 'EvilService',
                        'decoder.name': 'windows',
                        'full_log': 'Service started'
                    }
                ]
            }
        }
    
    def inject_attack(self, csv_file, attack_type='all', output_file=None):
        """
        Inject attack patterns into CSV file
        
        Args:
            csv_file: Input CSV file (e.g., daily_alerts.csv)
            attack_type: 'all' or specific attack ID (e.g., 'T1547.001_registry')
            output_file: Output file (default: overwrites input)
        """
        print(f"\n🎯 Requestly Attack Injector")
        print("="*60)
        
        # Read existing CSV
        try:
            df = pd.read_csv(csv_file)
            print(f"[+] Loaded {len(df)} existing alerts from {csv_file}")
        except FileNotFoundError:
            print(f"[!] File not found, creating new CSV")
            df = pd.DataFrame()
        
        # Determine which attacks to inject
        if attack_type == 'all':
            attacks_to_inject = self.attack_templates.keys()
        elif attack_type in self.attack_templates:
            attacks_to_inject = [attack_type]
        else:
            print(f"[!] Unknown attack type: {attack_type}")
            print(f"[*] Available types: {list(self.attack_templates.keys())}")
            return
        
        # Inject attacks
        base_time = datetime.now()
        injected_count = 0
        
        for attack_id in attacks_to_inject:
            attack = self.attack_templates[attack_id]
            print(f"\n[*] Injecting: {attack['name']} ({attack['mitre_id']})")
            
            for i, event in enumerate(attack['events']):
                # Add timestamp (events within attack happen close together)
                event['timestamp'] = (base_time + timedelta(seconds=i*10)).isoformat()
                event['@timestamp'] = event['timestamp']
                
                # Add common fields
                event['id'] = f"req_{attack_id}_{i}"
                event['agent.id'] = event['agent.name']
                
                # Convert to DataFrame row
                event_df = pd.DataFrame([event])
                df = pd.concat([df, event_df], ignore_index=True)
                injected_count += 1
                
                print(f"  ✓ Injected event {i+1}/{len(attack['events'])}: Rule {event['rule.id']}")
        
        # Save
        output = output_file or csv_file
        df.to_csv(output, index=False)
        
        print(f"\n✅ Injected {injected_count} malicious events")
        print(f"📁 Saved to: {output}")
        print(f"📊 Total alerts in file: {len(df)}")
        
        return output
    
    def create_test_scenario(self, output_file='requestly_test_alerts.csv'):
        """Create a complete test scenario with all attack types"""
        print("\n🧪 Creating Complete Test Scenario")
        print("="*60)
        
        # Start with empty DataFrame
        df = pd.DataFrame()
        
        # Add some benign events (noise)
        benign_events = [
            {
                'rule.id': '1002',
                'rule.level': '2',
                'rule.description': 'Unknown problem somewhere',
                'agent.name': 'prod-server-01',
                'timestamp': datetime.now().isoformat(),
                'full_log': 'Normal system activity'
            },
            {
                'rule.id': '5402',
                'rule.level': '3',
                'rule.description': 'Successful login',
                'agent.name': 'prod-server-02',
                'timestamp': datetime.now().isoformat(),
                'full_log': 'User logged in successfully'
            }
        ]
        
        for event in benign_events:
            event_df = pd.DataFrame([event])
            df = pd.concat([df, event_df], ignore_index=True)
        
        df.to_csv(output_file, index=False)
        print(f"[+] Created base file with {len(df)} benign events")
        
        # Now inject all attacks
        self.inject_attack(output_file, attack_type='all')
        
        print(f"\n🎯 Test scenario ready!")
        print(f"📂 File: {output_file}")
        print(f"\nRun your detector with:")
        print(f"  python3 persistence_detector.py --csv {output_file}")
    
    def list_attacks(self):
        """List available attack patterns"""
        print("\n📋 Available Attack Patterns:\n")
        for attack_id, attack in self.attack_templates.items():
            print(f"ID: {attack_id}")
            print(f"  Name: {attack['name']}")
            print(f"  MITRE: {attack['mitre_id']}")
            print(f"  Events: {len(attack['events'])}")
            print()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Requestly Attack Injector - Test your persistence detector',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create complete test scenario
  python3 requestly_attack_injector.py --scenario
  
  # Inject specific attack into existing CSV
  python3 requestly_attack_injector.py --inject daily_alerts.csv --attack T1547.001_registry
  
  # Inject all attacks
  python3 requestly_attack_injector.py --inject daily_alerts.csv --attack all
  
  # List available attacks
  python3 requestly_attack_injector.py --list
        """
    )
    
    parser.add_argument('--scenario', action='store_true',
                       help='Create complete test scenario')
    parser.add_argument('--inject', metavar='CSV_FILE',
                       help='Inject attacks into existing CSV')
    parser.add_argument('--attack', default='all',
                       help='Attack type to inject (default: all)')
    parser.add_argument('--output', metavar='OUTPUT_FILE',
                       help='Output file (default: overwrites input)')
    parser.add_argument('--list', action='store_true',
                       help='List available attack patterns')
    
    args = parser.parse_args()
    
    injector = AttackInjector()
    
    if args.list:
        injector.list_attacks()
    elif args.scenario:
        injector.create_test_scenario()
    elif args.inject:
        injector.inject_attack(args.inject, args.attack, args.output)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
