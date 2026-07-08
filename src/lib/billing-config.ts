export function isBillingLiveEnabled() {
  return process.env.BILLING_LIVE_ENABLED === "true";
}
