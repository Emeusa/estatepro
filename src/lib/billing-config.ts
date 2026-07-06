export function isBillingLiveEnabled() {
  return process.env.BILLING_LIVE_ENABLED === "true";
}

export function isOpayConfigured() {
  return Boolean(
    process.env.OPAY_MERCHANT_ID &&
      process.env.OPAY_PUBLIC_KEY &&
      process.env.OPAY_PRIVATE_KEY
  );
}
