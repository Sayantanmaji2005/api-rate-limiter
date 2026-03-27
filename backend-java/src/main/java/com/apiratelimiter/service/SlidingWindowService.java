package com.apiratelimiter.service;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Tier;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

    store.removeWindowByScore(key, 0L, now - windowMs);
    long countBefore = store.windowCount(key);
    boolean allowed = countBefore + safeCost <= limit;

    long countAfter = countBefore;
    if (allowed) {
      List<WindowEntry> entries = new ArrayList<>();
      for (int i = 0; i < safeCost; i++) {
        entries.add(new WindowEntry(now, now + "-" + i + "-" + UUID.randomUUID().toString().substring(0, 6)));
      }
      store.addWindowEntries(key, entries);
      countAfter = countBefore + safeCost;
    }

    int retryAfterSec = 0;
    if (!allowed) {
      WindowEntry oldest = store.getOldestWindowEntry(key);
      if (oldest != null) {
        long elapsed = now - oldest.score();
        retryAfterSec = Math.max((int) Math.ceil((double) (windowMs - elapsed) / 1000D), 1);
      }
    }

    LimiterResult result = new LimiterResult();
    result.setAllowed(allowed);
    result.setAlgorithm(RateLimitAlgorithm.SLIDING_WINDOW);
    result.setCost(safeCost);
    result.setRemaining(Math.max((int) (limit - countAfter), 0));
    result.setCapacity(limit);
    result.setRefillRate(null);
    result.setRetryAfterSec(retryAfterSec);
    return result;
  }

  private record WindowDefaults(int limit, int windowMs) {
  }
}
