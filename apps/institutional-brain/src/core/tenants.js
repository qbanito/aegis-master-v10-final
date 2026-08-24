import {TENANT_DEFINITIONS} from "./config.js";

// Multi-Tenant Architecture stub — Manhattan is one tenant among several, not hardcoded into
// the platform. This is branding/labeling only in this build, not real tenant data isolation.
export function listTenants() {
  return TENANT_DEFINITIONS;
}
