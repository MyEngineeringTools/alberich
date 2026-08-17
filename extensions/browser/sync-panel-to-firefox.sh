#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
# SPDX-License-Identifier: AGPL-3.0-only
# Wrapper: voller Sync
exec "$(cd "$(dirname "$0")" && pwd)/sync-from-chrome.sh"
