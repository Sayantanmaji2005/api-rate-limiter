package com.apiratelimiter.dto;

import com.apiratelimiter.model.RateLimitAlgorithm;
import java.util.LinkedHashMap;
import java.util.Map;

public class LimiterResult {

  private boolean allowed;
  private RateLimitAlgorithm algorithm;
  private int cost;
  private Integer remaining;
  private Integer capacity;
  private Integer refillRate;
  private int retryAfterSec;
  private boolean degraded;
  private String error;

  public static LimiterResult degradedFallback(RequestRule rule, String errorMessage) {
    LimiterResult result = new LimiterResult();
    result.allowed = false;
    result.algorithm = rule.algorithm();
    result.cost = rule.cost();
    result.remaining = null;
    result.capacity = null;
    result.refillRate = null;
    result.retryAfterSec = 1;
    result.degraded = true;
    result.error = errorMessage;
    return result;
  }

  public Map<String, Object> toMap() {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("allowed", allowed);
    map.put("algorithm", algorithm != null ? algorithm.name() : null);
    map.put("cost", cost);
    map.put("remaining", remaining);
    map.put("capacity", capacity);
    map.put("refillRate", refillRate);
    map.put("retryAfterSec", retryAfterSec);
    if (degraded) {
      map.put("degraded", true);
      map.put("error", error);
    }
    return map;
  }

  public boolean isAllowed() {
    return allowed;
  }

  public void setAllowed(boolean allowed) {
    this.allowed = allowed;
  }

  public RateLimitAlgorithm getAlgorithm() {
    return algorithm;
  }

  public void setAlgorithm(RateLimitAlgorithm algorithm) {
    this.algorithm = algorithm;
  }

  public int getCost() {
    return cost;
  }

  public void setCost(int cost) {
    this.cost = cost;
  }

  public Integer getRemaining() {
    return remaining;
  }

  public void setRemaining(Integer remaining) {
    this.remaining = remaining;
  }

  public Integer getCapacity() {
    return capacity;
  }

  public void setCapacity(Integer capacity) {
    this.capacity = capacity;
  }

  public Integer getRefillRate() {
    return refillRate;
  }

  public void setRefillRate(Integer refillRate) {
    this.refillRate = refillRate;
  }

  public int getRetryAfterSec() {
    return retryAfterSec;
  }

  public void setRetryAfterSec(int retryAfterSec) {
    this.retryAfterSec = retryAfterSec;
  }

  public boolean isDegraded() {
    return degraded;
  }

  public void setDegraded(boolean degraded) {
    this.degraded = degraded;
  }

  public String getError() {
    return error;
  }

  public void setError(String error) {
    this.error = error;
  }
}
