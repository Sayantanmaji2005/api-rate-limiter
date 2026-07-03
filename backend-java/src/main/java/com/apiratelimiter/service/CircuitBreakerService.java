package com.apiratelimiter.service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

@Service
public class CircuitBreakerService {

  private final int failureThreshold = 5;
  private final long resetTimeoutMs = 10_000L;
  private String state = "CLOSED";
  private int failureCount = 0;
  private long lastFailureAt = 0L;

  public synchronized boolean isOpen() {
    if (!"OPEN".equals(state)) {
      return false;
    }
    if (System.currentTimeMillis() - lastFailureAt > resetTimeoutMs) {
      state = "HALF_OPEN";
      return false;
    }
    return true;
  }

  public synchronized <T> T execute(Supplier<T> action, Function<Exception, T> fallback) {
    if (isOpen()) {
      return fallback.apply(null);
    }

    try {
      T result = action.get();
      failureCount = 0;
      state = "CLOSED";
      return result;
    } catch (Exception ex) {
      failureCount += 1;
      lastFailureAt = System.currentTimeMillis();
      if (failureCount >= failureThreshold) {
        state = "OPEN";
      }
      return fallback.apply(ex);
    }
  }

  public synchronized Map<String, Object> status() {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("state", state);
    map.put("failureCount", failureCount);
    map.put("resetTimeoutMs", resetTimeoutMs);
    return map;
  }
}
