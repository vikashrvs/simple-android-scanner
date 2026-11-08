import { device } from "./device.js";
import { specialAccess } from "./specialAccess.js";
import { installs } from "./installs.js";
import { indicators } from "./indicators.js";
import { network } from "./network.js";
import { storage } from "./storage.js";

/** Order matters: device runs first and fills ctx.device. */
export const MODULES = [device, specialAccess, installs, indicators, network, storage];

/** Slow or noisy modules stay off unless the user turns them on. */
export const DEFAULT_SELECTED = { device: true, specialAccess: true, installs: true, indicators: true, network: true, storage: false };
