#!/usr/bin/env bash
# One-time: allow phone on Wi-Fi to reach Vite dev server (Fedora firewalld).
set -euo pipefail
sudo firewall-cmd --zone=FedoraWorkstation --add-port=5173/tcp --permanent
sudo firewall-cmd --reload
echo "OK: port 5173/tcp open on Wi-Fi (FedoraWorkstation)"
firewall-cmd --list-ports
