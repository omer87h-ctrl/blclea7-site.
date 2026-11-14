/* One reviewed transport factory for all user-initiated CLEA Auto acquisitions. */
import { OBDBridge, OBD_PROFILES, createSerialOBDTransport } from './diagnostics.js';
import { hasNativeOBD, createNativeOBDTransport } from './native-obd.js';
import { getDeviceAccess } from './device-access.js';

export function autoBridgeAccess(profile) {
  if (profile === 'native') return { canRequest: hasNativeOBD(), reason: 'Android Classic SPP zahtijeva instalirani CLEA Auto paket i ranije upareni adapter.' };
  if (profile === 'serial' || profile === 'spp') return getDeviceAccess('serial');
  if (OBD_PROFILES.some(item => item.id === profile)) return getDeviceAccess('ble');
  return { canRequest: false, reason: 'Odaberite dokumentovani ELM profil.' };
}

export function createAutoBridge({ profile, onStatus, timeoutMs = 3500 } = {}) {
  const access = autoBridgeAccess(profile);
  if (!access.canRequest) throw new Error(access.reason);
  const options = { onStatus, timeoutMs };
  if (profile === 'native') options.transport = createNativeOBDTransport();
  else if (profile === 'serial' || profile === 'spp') options.transport = createSerialOBDTransport({ bluetoothOnly: profile === 'spp' });
  else options.profileId = profile;
  return new OBDBridge(options);
}
