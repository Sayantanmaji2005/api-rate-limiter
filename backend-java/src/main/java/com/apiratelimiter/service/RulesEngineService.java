package com.apiratelimiter.service;

import com.apiratelimiter.dto.RequestRule;
import com.apiratelimiter.model.CustomRule;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Tier;
import com.apiratelimiter.model.User;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class RulesEngineService {

  private static final Map<Tier, WindowDefaults> TIER_DEFAULTS = Map.of(
      Tier.FREE, new WindowDefaults(20, 60_000),
      Tier.PRO, new WindowDefaults(80, 60_000),
      Tier.ENTERPRISE, new WindowDefaults(200, 60_000)
  );

  private static final Map<String, Integer> BASE_RULES = new HashMap<>();

  static {
    BASE_RULES.put("GET:/api/data", 1);
    BASE_RULES.put("GET:/api/heavy-data", 5);
  }

  public RequestRule resolveRequestRule(User user, String endpoint, String method) {
    String normalizedMethod = method == null ? "GET" : method.toUpperCase();
    Tier tier = user.getTier() == null ? Tier.FREE : user.getTier();
    WindowDefaults defaults = TIER_DEFAULTS.getOrDefault(tier, TIER_DEFAULTS.get(Tier.FREE));

    int baseCost = BASE_RULES.getOrDefault(normalizedMethod + ":" + endpoint, 1);
    CustomRule customRule = findCustomRule(user.getCustomRules(), normalizedMethod, endpoint);

    RateLimitAlgorithm algorithm = user.getRateLimitAlgorithm() == null
        ? RateLimitAlgorithm.TOKEN_BUCKET
        : user.getRateLimitAlgorithm();

    int cost = clampCost(customRule != null && customRule.getCost() != null
        ? customRule.getCost()
        : baseCost);
    int windowLimit = customRule != null && customRule.getWindowLimit() != null
        ? customRule.getWindowLimit()
        : defaults.windowLimit();
    int windowMs = customRule != null && customRule.getWindowMs() != null
        ? customRule.getWindowMs()
        : defaults.windowMs();

    return new RequestRule(algorithm, cost, windowLimit, windowMs);
  }

  private CustomRule findCustomRule(List<CustomRule> customRules, String method, String endpoint) {
    if (customRules == null) {
      return null;
    }
    for (CustomRule rule : customRules) {
      if (rule == null || rule.getEndpoint() == null) {
        continue;
      }
      String ruleMethod = rule.getMethod() == null ? "GET" : rule.getMethod().toUpperCase();
      if (rule.getEndpoint().equals(endpoint) && ruleMethod.equals(method)) {
        return rule;
      }
    }
    return null;
  }

  private int clampCost(Integer value) {
    if (value == null) {
      return 1;
    }
    int numeric = value;
    if (numeric < 1) {
      return 1;
    }
    return Math.min(numeric, 20);
  }

  private record WindowDefaults(int windowLimit, int windowMs) {
  }
}
