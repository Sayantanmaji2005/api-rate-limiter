package com.apiratelimiter.dto;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

public class RateLimitDecision {

  private final boolean allowed;
  private final LimiterResult limiterResult;
  private final HttpHeaders headers;
  private final HttpStatus errorStatus;
  private final Map<String, Object> errorBody;

  private RateLimitDecision(
      boolean allowed,
      LimiterResult limiterResult,
      HttpHeaders headers,
      HttpStatus errorStatus,
      Map<String, Object> errorBody
  ) {
    this.allowed = allowed;
    this.limiterResult = limiterResult;
    this.headers = headers;
    this.errorStatus = errorStatus;
    this.errorBody = errorBody == null ? Collections.emptyMap() : errorBody;
  }

  public static RateLimitDecision allowed(LimiterResult limiterResult, HttpHeaders headers) {
    return new RateLimitDecision(true, limiterResult, headers, null, null);
  }

  public static RateLimitDecision blocked(
      LimiterResult limiterResult,
      HttpHeaders headers,
      HttpStatus status,
      String message
  ) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("msg", message);
    body.put("details", limiterResult.toMap());
    return new RateLimitDecision(false, limiterResult, headers, status, body);
  }

  public boolean isAllowed() {
    return allowed;
  }

  public LimiterResult getLimiterResult() {
    return limiterResult;
  }

  public HttpHeaders getHeaders() {
    return headers;
  }

  public HttpStatus getErrorStatus() {
    return errorStatus;
  }

  public Map<String, Object> getErrorBody() {
    return errorBody;
  }
}
