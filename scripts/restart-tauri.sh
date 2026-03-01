#!/bin/bash
# Quick restart script for Tauri dev

echo "Stopping existing processes..."
pkill -f "ggbond" 2>/dev/null || true
pkill -f "tauri" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

sleep 1

echo "Starting Tauri dev..."
cd /Volumes/SSD/Projects/Code/GGBond
npm run tauri dev
