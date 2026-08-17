/**
 * SPDX-FileCopyrightText: 2026 Christian Peter Kaiser
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Fill the three main-rotor <select> elements before app.js runs.
 */
import { MAIN_ROTOR_IDS } from './cipher-data.js';

['rotorLeft', 'rotorMiddle', 'rotorRight'].forEach((id) => {
  const select = document.getElementById(id);
  if (!select) return;
  MAIN_ROTOR_IDS.forEach((rotorId) => {
    const option = document.createElement('option');
    option.value = rotorId;
    option.textContent = rotorId;
    select.appendChild(option);
  });
});
