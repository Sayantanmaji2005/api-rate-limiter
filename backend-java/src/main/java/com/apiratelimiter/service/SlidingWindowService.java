package com.apiratelimiter.service;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.Tier;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class SlidingWindowService {

  private static final Map<Tier, WindowDefaults> TIER_LIMITS = Map.of(
      Tier.FREE, new WindowDefaults(20, 60_000),
      Tier.PRO, new WindowDefaults(80, 60_000),
      Tier.ENTERPRISE, new WindowDefaults(200, 60_000)
  );

  private final RedisMemoryStore store;

  public SlidingWindowService(RedisMemoryStore store) {
    this.store = store;
  }

  public LimiterResult evaluate(String userId, Tier tier, Integer overrideLimit, Integer overrideWindowMs, int cost) {
    WindowDefaults defaults = TIER_LIMITS.getOrDefault(tier == null ? Tier.FREE : tier, TIER_LIMITS.get(Tier.FREE));
    int limit = overrideLimit != null && overrideLimit > 0 ? overrideLimit : defaults.limit();
    int windowMs = overrideWindowMs != null && overrideWindowMs > 0 ? overrideWindowMs : defaults.windowMs();
    int safeCost = Math.max(cost, 1);
    String key = "window:" + userId;
    long now = System.currentTimeMillis();

    return store.evaluateSlidingWindow(key, limit, windowMs, safeCost, now);
  }

  private record WindowDefaults(int limit, int windowMs) {
  }
}
