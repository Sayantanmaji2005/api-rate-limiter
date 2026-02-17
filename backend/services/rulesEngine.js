const TIER_DEFAULTS = {
  FREE: { windowLimit: 20, windowMs: 60000 },
  PRO: { windowLimit: 80, windowMs: 60000 },
  ENTERPRISE: { windowLimit: 200, windowMs: 60000 }
};

const BASE_RULES = {
  "GET:/api/data": { cost: 1 },
  "GET:/api/heavy-data": { cost: 5 }
};

const clampCost = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(Math.max(Math.ceil(numeric), 1), 20);
};

function findCustomRule(customRules, method, endpoint) {
  if (!Array.isArray(customRules)) return null;
  return (
    customRules.find(
      (rule) =>
        rule?.endpoint === endpoint &&
        String(rule?.method || "GET").toUpperCase() === method
    ) || null
  );
}

function resolveRequestRule({ user, endpoint, method }) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const tierDefaults = TIER_DEFAULTS[user?.tier] || TIER_DEFAULTS.FREE;
  const baseRule = BASE_RULES[`${normalizedMethod}:${endpoint}`] || { cost: 1 };
  const customRule = findCustomRule(user?.customRules, normalizedMethod, endpoint);

  return {
    algorithm: user?.rateLimitAlgorithm || "TOKEN_BUCKET",
    cost: clampCost(customRule?.cost ?? baseRule.cost),
    windowLimit: Number(customRule?.windowLimit) || tierDefaults.windowLimit,
    windowMs: Number(customRule?.windowMs) || tierDefaults.windowMs
  };
}

module.exports = {
  resolveRequestRule
};
