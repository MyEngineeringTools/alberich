/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Screen Wake Lock while a live QR is shown or scanned.
 * Released when the last holder drops. Re-acquired on tab visible.
 */

const holders = new Set();
let sentinel = null;
let visBound = false;

function onVisibility() {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'visible' && holders.size) {
    void requestLock();
  }
}

async function requestLock() {
  try {
    if (typeof navigator === 'undefined' || !navigator.wakeLock?.request) return;
    if (sentinel) return;
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
      if (holders.size && typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void requestLock();
      }
    });
  } catch {
    sentinel = null;
  }
}

function dropLock() {
  try {
    sentinel?.release();
  } catch {
    /* ignore */
  }
  sentinel = null;
}

export async function acquireScreenWakeLock(id) {
  const key = String(id || 'default');
  holders.add(key);
  if (typeof document !== 'undefined' && !visBound) {
    document.addEventListener('visibilitychange', onVisibility);
    visBound = true;
  }
  await requestLock();
}

export function releaseScreenWakeLock(id) {
  holders.delete(String(id || 'default'));
  if (holders.size) return;
  dropLock();
  if (visBound && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibility);
    visBound = false;
  }
}
