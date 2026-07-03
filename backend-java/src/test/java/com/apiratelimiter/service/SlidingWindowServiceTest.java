package com.apiratelimiter.service;

import static org.junit.jupiter.api.Assertions.*;

import com.apiratelimiter.config.AppProperties;
import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Tier;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class SlidingWindowServiceTest {

  private SlidingWindowService service;

  @BeforeEach
  public void setUp() {
    AppProperties properties = new AppProperties();
    properties.setRedisUrl("memory");
    RedisMemoryStore store = new RedisMemoryStore(properties, null, new ObjectMapper());
    service = new SlidingWindowService(store);
  }

  @Test
  public void testAllowedUnderLimit() {
    LimiterResult result = service.evaluate("user1", Tier.FREE, 5, 1000, 1);
    assertTrue(result.isAllowed());
    assertEquals(RateLimitAlgorithm.SLIDING_WINDOW, result.getAlgorithm());
    assertEquals(4, result.getRemaining());
    assertEquals(5, result.getCapacity());
  }

  @Test
  public void testBlockedOverLimit() {
    // Limit is 2
    service.evaluate("user2", Tier.FREE, 2, 1000, 1);
    service.evaluate("user2", Tier.FREE, 2, 1000, 1);

    // 3rd request should be blocked
    LimiterResult blocked = service.evaluate("user2", Tier.FREE, 2, 1000, 1);
    assertFalse(blocked.isAllowed());
    assertEquals(0, blocked.getRemaining());
    assertTrue(blocked.getRetryAfterSec() > 0);
  }

  @Test
  public void testWindowExpiration() throws InterruptedException {
    // Limit is 2, window is 1000ms
    service.evaluate("user3", Tier.FREE, 2, 1000, 1);
    service.evaluate("user3", Tier.FREE, 2, 1000, 1);

    // Blocked
    assertFalse(service.evaluate("user3", Tier.FREE, 2, 1000, 1).isAllowed());

    // Sleep 1.1s to allow entries to drop out of window
    Thread.sleep(1100);

    // Should be allowed again
    LimiterResult allowedAgain = service.evaluate("user3", Tier.FREE, 2, 1000, 1);
    assertTrue(allowedAgain.isAllowed());
  }
}
