export const SCOPES = ["search_products", "purchase", "check_budget"] as const;

export const DENIAL_REASONS = {
  invalid_or_expired_token: "Passport signature is invalid or it has expired",
  agent_revoked: "Agent has been revoked by its owner",
  passport_superseded: "A newer passport has been issued for this agent",
  action_not_permitted: "Action is not in the passport's scopes",
  exceeds_per_txn_limit: "Amount is above the per-transaction limit",
  exceeds_daily_budget: "Amount would exceed the daily budget",
  pending_approval: "Human approval is required before this can run",
  unknown_product: "Product does not exist",
  internal_error: "Internal error (failed closed)",
} as const;

export const PASSPORT_ISSUER = "agentos";

/** Money is integer paise everywhere. Convert only for display. */
export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);
export const formatINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(paise / 100);
