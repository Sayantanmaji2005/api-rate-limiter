package com.apiratelimiter.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.dto.RateLimitDecision;
import com.apiratelimiter.dto.RequestRule;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Tier;
import com.apiratelimiter.model.User;
import com.apiratelimiter.util.IpAddressUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

public class RateLimiterServiceTest {

  private RulesEngineService rulesEngineService;
  private SlidingWindowService slidingWindowService;
  private TokenBucketService tokenBucketService;
  private CircuitBreakerService circuitBreakerService;
  private AnalyticsService analyticsService;
  private IpAddressUtil ipAddressUtil;

  private RateLimiterService rateLimiterService;

  @BeforeEach
  public void setUp() {
    rulesEngineService = mock(RulesEngineService.class);
    slidingWindowService = mock(SlidingWindowService.class);
    tokenBucketService = mock(TokenBucketService.class);
    circuitBreakerService = mock(CircuitBreakerService.class);
    analyticsService = mock(AnalyticsService.class);
    ipAddressUtil = mock(IpAddressUtil.class);

    rateLimiterService = new RateLimiterService(
        rulesEngineService,
        slidingWindowService,
        tokenBucketService,
        circuitBreakerService,
        analyticsService,
        ipAddressUtil
    );
  }

  @Test
  public void testIpBlacklisted() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    User user = new User();
    user.setId("u1");
    user.setBlacklist(List.of("192.168.1.1"));

    when(ipAddressUtil.resolveClientIp(request)).thenReturn("192.168.1.1");

    ApiException ex = assertThrows(ApiException.class, () -> {
      rateLimiterService.evaluate(request, user);
    });

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    assertEquals("IP Blacklisted", ex.getMessage());
  }

  @Test
  public void testIpNotWhitelisted() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    User user = new User();
    user.setId("u1");
    user.setWhitelist(List.of("192.168.1.10"));

    when(ipAddressUtil.resolveClientIp(request)).thenReturn("192.168.1.20");

    ApiException ex = assertThrows(ApiException.class, () -> {
      rateLimiterService.evaluate(request, user);
    });

    assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    assertEquals("IP Not Whitelisted", ex.getMessage());
  }

  @Test
  public void testDecisionAllowed() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getRequestURI()).thenReturn("/api/data");
    when(request.getMethod()).thenReturn("GET");

    User user = new User();
    user.setId("u2");
    user.setTier(Tier.FREE);

    when(ipAddressUtil.resolveClientIp(request)).thenReturn("127.0.0.1");

    RequestRule rule = new RequestRule(RateLimitAlgorithm.TOKEN_BUCKET, 1, 10, 60000);
    when(rulesEngineService.resolveRequestRule(user, "/api/data", "GET")).thenReturn(rule);

    LimiterResult allowedResult = new LimiterResult();
    allowedResult.setAllowed(true);
    allowedResult.setAlgorithm(RateLimitAlgorithm.TOKEN_BUCKET);
    allowedResult.setRemaining(9);
    allowedResult.setCapacity(10);

    // Mock circuit breaker to simply execute the action
    when(circuitBreakerService.execute(any(Supplier.class), any(Function.class)))
        .thenAnswer(invocation -> {
          Supplier<LimiterResult> supplier = invocation.getArgument(0);
          return supplier.get();
        });

    when(tokenBucketService.evaluate(eq("u2"), eq(Tier.FREE), eq(1))).thenReturn(allowedResult);

    RateLimitDecision decision = rateLimiterService.evaluate(request, user);

    assertTrue(decision.isAllowed());
    assertNull(decision.getErrorStatus()); // No error status on allowed
    assertEquals("9", decision.getHeaders().getFirst("X-RateLimit-Remaining"));
    assertEquals("10", decision.getHeaders().getFirst("X-RateLimit-Capacity"));
  }
}
