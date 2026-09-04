/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Frozen product MUR parameters. Not user-configurable.
 */

export const CBQR2_MUR_PROFILE_V1 = Object.freeze({
  id: 'CBQR2_MUR_PROFILE_V1',
  maxFragmentLen: 250,
  minFragmentLen: 10,
  fps: 4,
  ecc: 'M',
  urCase: 'uppercase',
  qrMode: 'Alphanumeric',
  minCssPx: 320,
  maxCssPx: 512,
});
