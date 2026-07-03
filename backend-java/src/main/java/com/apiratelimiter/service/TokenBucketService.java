package com.apiratelimiter.service;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.Tier;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class TokenBucketService {

  private static final Map<Tier, TokenLimits> LIMITS = Map.of(
      Tier.FREE, new TokenLimits(10, 1),
      Tier.PRO, new TokenLimits(50, 5),
      Tier.ENTERPRISE, new TokenLimits(200, 20)
  );

  private final RedisMemoryStore store;

  public TokenBucketService(RedisMemoryStore store) {
    this.store = store;
  }

  public LimiterResult evaluate(String userId, Tier tier, int cost) {
    int safeCost = Math.max(cost, 1);
    String key = "bucket:" + userId;
    long now = System.currentTimeMillis();

    TokenLimits tierLimits = LIMITS.getOrDefault(tier == null ? Tier.FREE : tier, LIMITS.get(Tier.FREE));
    return store.evaluateTokenBucket(key, tierLimits.capacity(), tierLimits.refillRate(), safeCost, now);
  }

  private record TokenLimits(int capacity, int refillRate) {
  }
}
