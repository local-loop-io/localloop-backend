#!/bin/bash
# LocalLoop Backend Deployment Setup Script
# This script provisions the non-root user and sets up the deployment environment.
# Run as root: sudo bash deploy/setup.sh

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/localloop-backend}"
SERVICE_USER="${SERVICE_USER:-localloop}"
SERVICE_GROUP="${SERVICE_GROUP:-localloop}"

echo "=== LocalLoop Backend Deployment Setup ==="
echo "Install directory: $INSTALL_DIR"
echo "Service user: $SERVICE_USER"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "Error: This script must be run as root (sudo)"
   exit 1
fi

# Create system user if it doesn't exist
if ! id "$SERVICE_USER" &>/dev/null; then
    echo "Creating system user: $SERVICE_USER"
    useradd -r -s /usr/sbin/nologin -d "$INSTALL_DIR" -m "$SERVICE_USER"
else
    echo "User $SERVICE_USER already exists"
fi

# Create installation directory
echo "Setting up installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/data"

# Copy application files (if running from source directory)
if [[ -f "src/index.ts" ]]; then
    echo "Copying application files..."
    cp -r src package.json bun.lock prisma prisma.config.ts "$INSTALL_DIR/"

    # Copy .env.example if .env doesn't exist
    if [[ ! -f "$INSTALL_DIR/.env" ]]; then
        cp .env.example "$INSTALL_DIR/.env"
        echo ""
        echo "IMPORTANT: Edit $INSTALL_DIR/.env with your production configuration!"
        echo "Required: DATABASE_URL, MINIO_SECRET_KEY, BETTER_AUTH_SECRET (if auth enabled)"
    fi
fi

# Set ownership
echo "Setting ownership to $SERVICE_USER:$SERVICE_GROUP..."
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"

# Install systemd service
if [[ -f "deploy/localloop-backend.service" ]]; then
    echo "Installing systemd service..."
    cp deploy/localloop-backend.service /etc/systemd/system/localloop-backend.service
    systemctl daemon-reload
    echo "Service installed. Enable with: systemctl enable localloop-backend"
    echo "Start with: systemctl start localloop-backend"
fi

# Verify bun is installed
if ! command -v bun &>/dev/null; then
    echo ""
    echo "WARNING: bun is not installed. Install it with:"
    echo "  curl -fsSL https://bun.sh/install | bash"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit $INSTALL_DIR/.env with production credentials"
echo "2. Run 'cd $INSTALL_DIR && bun install' as $SERVICE_USER"
echo "3. Run 'systemctl enable --now localloop-backend'"
echo "4. Check status with 'systemctl status localloop-backend'"
