package com.apiratelimiter.service;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.RateLimitAlgorithm;
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
    BucketState bucket = store.getBucket(key);
    if (bucket == null) {
      bucket = new BucketState(tierLimits.capacity(), now);
    }

    long elapsedSeconds = Math.floorDiv(now - bucket.getLastRefill(), 1000L);
    if (elapsedSeconds > 0) {
      int refill = (int) (elapsedSeconds * tierLimits.refillRate());
      bucket.setTokens(Math.min(tierLimits.capacity(), bucket.getTokens() + refill));
      bucket.setLastRefill(bucket.getLastRefill() + elapsedSeconds * 1000L);
      if (bucket.getTokens() >= tierLimits.capacity()) {
        bucket.setLastRefill(now);
      }
    }

    boolean allowed = bucket.getTokens() >= safeCost;
    if (allowed) {
      bucket.setTokens(bucket.getTokens() - safeCost);
    }
    store.setBucket(key, bucket);

    int tokenDeficit = Math.max(safeCost - bucket.getTokens(), 0);
    int retryAfterSec = allowed
        ? 0
        : (int) Math.ceil((double) tokenDeficit / Math.max(tierLimits.refillRate(), 1));

    LimiterResult result = new LimiterResult();
    result.setAllowed(allowed);
    result.setAlgorithm(RateLimitAlgorithm.TOKEN_BUCKET);
    result.setCost(safeCost);
    result.setRemaining((int) Math.floor(bucket.getTokens()));
    result.setCapacity(tierLimits.capacity());
    result.setRefillRate(tierLimits.refillRate());
    result.setRetryAfterSec(retryAfterSec);
    return result;
  }

  private record TokenLimits(int capacity, int refillRate) {
  }
}
