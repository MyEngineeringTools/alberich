#!/usr/bin/env bash
# Wrapper: voller Sync
exec "$(cd "$(dirname "$0")" && pwd)/sync-from-chrome.sh"
