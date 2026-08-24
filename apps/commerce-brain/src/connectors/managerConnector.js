import {store} from "../core/store.js";
import {MASTER_BRAIN_URL} from "../core/config.js";

/**
 * Manager Brain connectivity has no live health probe wired yet — today it's an internal flag set
 * at boot. Reported honestly as CONNECTED_UNVERIFIED rather than a plain READY so the UI doesn't
 * imply a live check that never happened.
 */
export async function probeManager() {
  return {
    online: null,
    configured: Boolean(MASTER_BRAIN_URL),
    readiness: store.masterControl.connected ? "CONNECTED_UNVERIFIED" : "DEGRADED",
    detail: "Internal flag only — no live health probe wired yet",
    checkedAt: new Date().toISOString()
  };
}
