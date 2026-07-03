package com.apiratelimiter.service;

import static org.junit.jupiter.api.Assertions.*;

import com.apiratelimiter.config.AppProperties;
import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Tier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class TokenBucketServiceTest {

  private TokenBucketService service;

  @BeforeEach
  public void setUp() {
    AppProperties properties = new AppProperties();
    properties.setRedisUrl("memory");
    RedisMemoryStore store = new RedisMemoryStore(properties, null, new ObjectMapper());
    service = new TokenBucketService(store);
  }

  @Test
  public void testAllowedUnderCapacity() {
    LimiterResult result = service.evaluate("user1", Tier.FREE, 1);
    assertTrue(result.isAllowed());
    assertEquals(RateLimitAlgorithm.TOKEN_BUCKET, result.getAlgorithm());
    assertEquals(9, result.getRemaining());
    assertEquals(10, result.getCapacity());
  }

  @Test
  public void testBlockedOverCapacity() {
    // FREE has limit 10, refill rate 1
    // Consume 10 tokens
    for (int i = 0; i < 10; i++) {
      LimiterResult result = service.evaluate("user2", Tier.FREE, 1);
      assertTrue(result.isAllowed());
    }

    // 11th token request should be blocked
    LimiterResult blockedResult = service.evaluate("user2", Tier.FREE, 1);
    assertFalse(blockedResult.isAllowed());
    assertEquals(0, blockedResult.getRemaining());
    assertTrue(blockedResult.getRetryAfterSec() > 0);
  }

  @Test
  public void testRefillOverTime() throws InterruptedException {
    // Consume all 10 tokens
    for (int i = 0; i < 10; i++) {
      service.evaluate("user3", Tier.FREE, 1);
    }

    // Immediately blocked
    assertFalse(service.evaluate("user3", Tier.FREE, 1).isAllowed());

    // Sleep 1 second (1000ms) to allow 1 token to refill (FREE refill rate = 1 token/sec)
    Thread.sleep(1100);

    // Should now be allowed for 1 token
    LimiterResult refilledResult = service.evaluate("user3", Tier.FREE, 1);
    assertTrue(refilledResult.isAllowed());
  }
}
