#!/bin/bash

# Paper Resource Monitor - Installation Script
# Downloads and installs the resource monitoring script as a systemd service

set -e

# Configuration
SCRIPT_URL="https://raw.githubusercontent.com/aibelbin/paper/main/client-toolkit/main.py"
FEDERATED_SCRIPT_URL="https://raw.githubusercontent.com/aibelbin/paper/main/client-toolkit/federatedClient.py"
INSTALL_DIR="/opt/paper-monitor"
SERVICE_NAME="paper-monitor"
PYTHON_SCRIPT="main.py"
FEDERATED_SCRIPT="federatedClient.py"

# Default values for config (can be overridden via environment variables)
API_ENDPOINT="${API_ENDPOINT:-}"
SYSTEM_ID="${SYSTEM_ID:-}"
MONITOR_INTERVAL="${MONITOR_INTERVAL:-10}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-30}"

# Federated learning config defaults
FEDERATED_COLLECTION_INTERVAL="${FEDERATED_COLLECTION_INTERVAL:-10}"
FEDERATED_WINDOW_MINUTES="${FEDERATED_WINDOW_MINUTES:-15}"
FEDERATED_AGGREGATOR_ENDPOINT="${FEDERATED_AGGREGATOR_ENDPOINT:-}"
FEDERATED_UPDATE_INTERVAL="${FEDERATED_UPDATE_INTERVAL:-300}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run this script as root (use sudo -E)"
    exit 1
fi

# Validate required environment variables
if [ -z "$API_ENDPOINT" ]; then
    log_error "API_ENDPOINT is required. Set it via environment variable."
    echo "Example: API_ENDPOINT=https://api.example.com/metrics sudo -E bash install.sh"
    exit 1
fi

if [ -z "$SYSTEM_ID" ]; then
    log_error "SYSTEM_ID is required. Set it via environment variable."
    echo "Example: SYSTEM_ID=my-server-01 sudo -E bash install.sh"
    exit 1
fi

# Check for required commands
for cmd in curl python3 pip3 systemctl; do
    if ! command -v $cmd &> /dev/null; then
        log_error "$cmd is required but not installed"
        exit 1
    fi
done

log_info "Starting Paper Resource Monitor installation..."

# Create installation directory
log_info "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Download the Python scripts
log_info "Downloading monitoring script from $SCRIPT_URL"
if curl -fsSL "$SCRIPT_URL" -o "$INSTALL_DIR/$PYTHON_SCRIPT"; then
    log_info "Main script downloaded successfully"
else
    log_error "Failed to download main script"
    exit 1
fi

log_info "Downloading federated client from $FEDERATED_SCRIPT_URL"
if curl -fsSL "$FEDERATED_SCRIPT_URL" -o "$INSTALL_DIR/$FEDERATED_SCRIPT"; then
    log_info "Federated client downloaded successfully"
else
    log_error "Failed to download federated client"
    exit 1
fi

# Make the scripts executable
chmod +x "$INSTALL_DIR/$PYTHON_SCRIPT"
chmod +x "$INSTALL_DIR/$FEDERATED_SCRIPT"

# Install Python dependencies
log_info "Installing Python dependencies..."
pip3 install --quiet requests psutil numpy

# Install Wazuh Agent
log_info "Installing VPS Agent..."
WAZUH_AGENT_DEB="wazuh-agent_4.14.2-1_amd64.deb"
WAZUH_URL="https://packages.wazuh.com/4.x/apt/pool/main/w/wazuh-agent/$WAZUH_AGENT_DEB"

if curl -L -o "$WAZUH_AGENT_DEB" "$WAZUH_URL"; then
    log_info "VPS agent downloaded successfully"
    WAZUH_MANAGER='143.110.250.168' WAZUH_AGENT_NAME="$SYSTEM_ID" dpkg -i "./$WAZUH_AGENT_DEB"
    rm -f "$WAZUH_AGENT_DEB"
    
    # Enable and start Wazuh agent
    systemctl daemon-reload
    systemctl enable wazuh-agent
    systemctl start wazuh-agent
    log_info "VPS agent installed and started"
else
    log_error "Failed to download VPS agent"
fi

# Create config directory and file with provided values
CONFIG_DIR="/root/.paper"
CONFIG_FILE="$CONFIG_DIR/config.json"

log_info "Creating config file at $CONFIG_FILE..."
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" << EOF
{
    "api_endpoint": "$API_ENDPOINT",
    "system_id": "$SYSTEM_ID",
    "monitor_interval": $MONITOR_INTERVAL,
    "request_timeout": $REQUEST_TIMEOUT,
    "federated_collection_interval": $FEDERATED_COLLECTION_INTERVAL,
    "federated_window_minutes": $FEDERATED_WINDOW_MINUTES,
    "federated_aggregator_endpoint": "$FEDERATED_AGGREGATOR_ENDPOINT",
    "federated_update_interval": $FEDERATED_UPDATE_INTERVAL
}
EOF
log_info "Config file created with provided values"



# Create systemd service file
log_info "Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Paper Resource Monitor Service
After=network.target network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/$PYTHON_SCRIPT
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables (optional)
Environment="HOME=/root"

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd daemon
log_info "Reloading systemd daemon..."
systemctl daemon-reload

# Enable the service to start on boot
log_info "Enabling service to start on boot..."
systemctl enable "$SERVICE_NAME"

# Start the service
log_info "Starting the service..."
systemctl start "$SERVICE_NAME"

# Check service status
if systemctl is-active --quiet "$SERVICE_NAME"; then
    log_info "Service started successfully!"
else
    log_error "Service failed to start. Check logs with: journalctl -u $SERVICE_NAME -f"
    exit 1
fi


# Register host with backend
log_info "Registering host with backend..."
# Get public IP
PUBLIC_IP=$(curl -s ifconfig.me)
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="127.0.0.1"
fi

# Extract base URL (remove /api/metrics if present)
BASE_URL="${API_ENDPOINT%/api/metrics}"
HOST_ADD_URL="${BASE_URL}/host/add"

log_info "Sending registration request to $HOST_ADD_URL"
# Use curl to hit the GET endpoint
if curl -fsSL "${HOST_ADD_URL}?system_id=${SYSTEM_ID}&ip_address=${PUBLIC_IP}"; then
    log_info "Host registered successfully"
else
    log_warn "Failed to register host active status. The service will still start."
fi

echo ""
echo "=============================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "Service Name: $SERVICE_NAME"
echo "Install Dir:  $INSTALL_DIR"
echo "Config File:  $CONFIG_FILE"
echo ""
echo "Useful commands:"
echo "  Check status:    sudo systemctl status $SERVICE_NAME"
echo "  View logs:       sudo journalctl -u $SERVICE_NAME -f"
echo "  Stop service:    sudo systemctl stop $SERVICE_NAME"
echo "  Restart:         sudo systemctl restart $SERVICE_NAME"
echo "  Disable:         sudo systemctl disable $SERVICE_NAME"
echo ""
