package com.apiratelimiter.service;

import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.dto.RateLimitDecision;
import com.apiratelimiter.dto.RequestRule;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.AnalyticsEvent;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.User;
import com.apiratelimiter.util.IpAddressUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RateLimiterService {

  private final RulesEngineService rulesEngineService;
  private final SlidingWindowService slidingWindowService;
  private final TokenBucketService tokenBucketService;
  private final CircuitBreakerService circuitBreakerService;
  private final AnalyticsService analyticsService;
  private final IpAddressUtil ipAddressUtil;

  public RateLimiterService(
      RulesEngineService rulesEngineService,
      SlidingWindowService slidingWindowService,
      TokenBucketService tokenBucketService,
      CircuitBreakerService circuitBreakerService,
      AnalyticsService analyticsService,
      IpAddressUtil ipAddressUtil
  ) {
    this.rulesEngineService = rulesEngineService;
    this.slidingWindowService = slidingWindowService;
    this.tokenBucketService = tokenBucketService;
    this.circuitBreakerService = circuitBreakerService;
    this.analyticsService = analyticsService;
    this.ipAddressUtil = ipAddressUtil;
  }

  public RateLimitDecision evaluate(HttpServletRequest request, User user) {
    long start = System.currentTimeMillis();
    try {
      String ip = ipAddressUtil.resolveClientIp(request);

      if (user.getBlacklist() != null && user.getBlacklist().contains(ip)) {
        throw new ApiException(HttpStatus.FORBIDDEN, "IP Blacklisted");
      }

      if (user.getWhitelist() != null && !user.getWhitelist().isEmpty() && !user.getWhitelist().contains(ip)) {
        throw new ApiException(HttpStatus.FORBIDDEN, "IP Not Whitelisted");
      }

      String endpoint = request.getRequestURI();
      RequestRule rule = rulesEngineService.resolveRequestRule(user, endpoint, request.getMethod());

      LimiterResult limiterResult = circuitBreakerService.execute(
          () -> {
            if (rule.algorithm() == RateLimitAlgorithm.SLIDING_WINDOW) {
              return slidingWindowService.evaluate(user.getId(), user.getTier(), rule.windowLimit(), rule.windowMs(), rule.cost());
            }
            return tokenBucketService.evaluate(user.getId(), user.getTier(), rule.cost());
          },
          ex -> LimiterResult.degradedFallback(
              rule,
              ex != null ? ex.getMessage() : "Limiter backend unavailable"
          )
      );

      HttpHeaders headers = buildHeaders(limiterResult);
      if (!limiterResult.isAllowed()) {
        if (limiterResult.getRetryAfterSec() > 0) {
          headers.add("Retry-After", String.valueOf(limiterResult.getRetryAfterSec()));
          long resetAt = Math.floorDiv(System.currentTimeMillis(), 1000L) + limiterResult.getRetryAfterSec();
          headers.add("X-RateLimit-Reset", String.valueOf(resetAt));
        }

        String blockedReason = limiterResult.isDegraded()
            ? "CIRCUIT_BREAKER_OPEN"
            : "RATE_LIMIT_EXCEEDED";

        analyticsService.save(newAnalyticsEvent(
            user.getId(),
            request,
            limiterResult,
            rule.cost(),
            false,
            blockedReason,
            ip,
            System.currentTimeMillis() - start
        ));

        return RateLimitDecision.blocked(
            limiterResult,
            headers,
            limiterResult.isDegraded() ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.TOO_MANY_REQUESTS,
            limiterResult.isDegraded() ? "Rate limiting temporarily unavailable" : "Rate limit exceeded"
        );
      }

      analyticsService.save(newAnalyticsEvent(
          user.getId(),
          request,
          limiterResult,
          rule.cost(),
          true,
          limiterResult.isDegraded() ? "CIRCUIT_BREAKER_FALLBACK" : "ALLOWED",
          ip,
          System.currentTimeMillis() - start
      ));

      return RateLimitDecision.allowed(limiterResult, headers);
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Rate limiter failure", "error", ex.getMessage())
      );
    }
  }

  private HttpHeaders buildHeaders(LimiterResult limiterResult) {
    HttpHeaders headers = new HttpHeaders();
    headers.add("X-RateLimit-Algorithm", limiterResult.getAlgorithm().name());
    if (limiterResult.getCapacity() != null) {
      headers.add("X-RateLimit-Limit", String.valueOf(limiterResult.getCapacity()));
      headers.add("X-RateLimit-Capacity", String.valueOf(limiterResult.getCapacity()));
    }
    if (limiterResult.getRemaining() != null) {
      headers.add("X-RateLimit-Remaining", String.valueOf(limiterResult.getRemaining()));
    }
    return headers;
  }

  private AnalyticsEvent newAnalyticsEvent(
      String userId,
      HttpServletRequest request,
      LimiterResult limiterResult,
      int cost,
      boolean allowed,
      String reason,
      String ip,
      long latencyMs
  ) {
    AnalyticsEvent event = new AnalyticsEvent();
    event.setUserId(userId);
    event.setEndpoint(request.getRequestURI());
    event.setMethod(request.getMethod());
    event.setAlgorithm(limiterResult.getAlgorithm().name());
    event.setCost(cost);
    event.setAllowed(allowed);
    event.setReason(reason);
    event.setIp(ip);
    event.setUserAgent(request.getHeader("User-Agent") == null ? "" : request.getHeader("User-Agent"));
    event.setLatencyMs(latencyMs);
    event.setExpiresAt(Instant.now().plusSeconds(30L * 24 * 60 * 60));
    event.setTimestamp(Instant.now());
    return event;
  }
}
