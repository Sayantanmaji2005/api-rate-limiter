package com.apiratelimiter.controller;

import com.apiratelimiter.dto.AuthUserContext;
import com.apiratelimiter.dto.RateLimitDecision;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.CustomRule;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.User;
import com.apiratelimiter.repo.UserRepository;
import com.apiratelimiter.service.AnalyticsService;
import com.apiratelimiter.service.AuthService;
import com.apiratelimiter.service.CircuitBreakerService;
import com.apiratelimiter.service.RateLimiterService;
import com.apiratelimiter.util.AnalyticsViewMapper;
import com.apiratelimiter.util.UserViewMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProtectedApiController {

  private static final Set<String> ALLOWED_METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE");

  private final AuthService authService;
  private final RateLimiterService rateLimiterService;
  private final AnalyticsService analyticsService;
  private final UserRepository userRepository;
  private final CircuitBreakerService circuitBreakerService;
  private final AnalyticsViewMapper analyticsViewMapper;
  private final UserViewMapper userViewMapper;

  public ProtectedApiController(
      AuthService authService,
      RateLimiterService rateLimiterService,
      AnalyticsService analyticsService,
      UserRepository userRepository,
      CircuitBreakerService circuitBreakerService,
      AnalyticsViewMapper analyticsViewMapper,
      UserViewMapper userViewMapper
  ) {
    this.authService = authService;
    this.rateLimiterService = rateLimiterService;
    this.analyticsService = analyticsService;
    this.userRepository = userRepository;
    this.circuitBreakerService = circuitBreakerService;
    this.analyticsViewMapper = analyticsViewMapper;
    this.userViewMapper = userViewMapper;
  }

  @GetMapping("/data")
  public ResponseEntity<?> data(HttpServletRequest request) {
    User user = resolveUser(request);
    RateLimitDecision decision = rateLimiterService.evaluate(request, user);
    if (!decision.isAllowed()) {
      return ResponseEntity.status(decision.getErrorStatus())
          .headers(decision.getHeaders())
          .body(decision.getErrorBody());
    }

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("message", "Protected API Access Granted");
    body.put("rateLimit", decision.getLimiterResult().toMap());
    return ResponseEntity.ok().headers(decision.getHeaders()).body(body);
  }

  @GetMapping("/heavy-data")
  public ResponseEntity<?> heavyData(HttpServletRequest request) {
    User user = resolveUser(request);
    RateLimitDecision decision = rateLimiterService.evaluate(request, user);
    if (!decision.isAllowed()) {
      return ResponseEntity.status(decision.getErrorStatus())
          .headers(decision.getHeaders())
          .body(decision.getErrorBody());
    }

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("records", 5000);
    payload.put("generatedAt", Instant.now().toString());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("message", "Heavy endpoint served");
    body.put("payload", payload);
    return ResponseEntity.ok().headers(decision.getHeaders()).body(body);
  }

  @GetMapping("/analytics")
  public ResponseEntity<?> analytics(HttpServletRequest request) {
    try {
      User user = resolveUser(request);
      return ResponseEntity.ok(analyticsViewMapper.toMapList(analyticsService.recentForUser(user.getId())));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR, "Server Error");
    }
  }

  @GetMapping("/analytics/summary")
  public ResponseEntity<?> analyticsSummary(HttpServletRequest request) {
    try {
      User user = resolveUser(request);
      return ResponseEntity.ok(analyticsService.userSummary(user.getId()));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to load analytics summary", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/settings/algorithm")
  public ResponseEntity<?> updateAlgorithm(
      HttpServletRequest request,
      @RequestBody Map<String, Object> body
  ) {
    try {
      User user = resolveUser(request);
      String algorithmName = String.valueOf(body.getOrDefault("algorithm", "")).trim().toUpperCase(Locale.ROOT);
      RateLimitAlgorithm algorithm;
      try {
        algorithm = RateLimitAlgorithm.valueOf(algorithmName);
      } catch (Exception ex) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid algorithm");
      }

      user.setRateLimitAlgorithm(algorithm);
      user = userRepository.save(user);
      return ResponseEntity.ok(Map.of("msg", "Algorithm updated", "user", userViewMapper.toPublicUser(user)));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update algorithm", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/settings/rules")
  public ResponseEntity<?> upsertRule(
      HttpServletRequest request,
      @RequestBody Map<String, Object> body
  ) {
    try {
      User user = resolveUser(request);

      String endpoint = String.valueOf(body.getOrDefault("endpoint", "")).trim();
      if (!endpoint.startsWith("/")) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Endpoint must start with '/'");
      }

      String method = String.valueOf(body.getOrDefault("method", "GET")).toUpperCase(Locale.ROOT);
      if (!ALLOWED_METHODS.contains(method)) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid HTTP method");
      }

      Integer cost = parsePositiveInt(body.get("cost"));
      if (cost == null || cost > 20) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Cost must be between 1 and 20");
      }

      Integer windowLimit = body.containsKey("windowLimit") ? parsePositiveInt(body.get("windowLimit")) : null;
      if (body.containsKey("windowLimit") && windowLimit == null) {
        throw new ApiException(
            org.springframework.http.HttpStatus.BAD_REQUEST,
            "windowLimit must be a positive integer"
        );
      }

      Integer windowMs = body.containsKey("windowMs") ? parsePositiveInt(body.get("windowMs")) : null;
      if (body.containsKey("windowMs") && (windowMs == null || windowMs < 1000)) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "windowMs must be at least 1000");
      }

      List<CustomRule> rules = user.getCustomRules();
      if (rules == null) {
        rules = new ArrayList<>();
        user.setCustomRules(rules);
      }

      CustomRule nextRule = new CustomRule();
      nextRule.setEndpoint(endpoint);
      nextRule.setMethod(method);
      nextRule.setCost(cost);
      if (windowLimit != null) {
        nextRule.setWindowLimit(windowLimit);
      }
      if (windowMs != null) {
        nextRule.setWindowMs(windowMs);
      }

      int existingIndex = -1;
      for (int i = 0; i < rules.size(); i++) {
        CustomRule rule = rules.get(i);
        String ruleMethod = rule.getMethod() == null ? "GET" : rule.getMethod().toUpperCase(Locale.ROOT);
        if (endpoint.equals(rule.getEndpoint()) && method.equals(ruleMethod)) {
          existingIndex = i;
          break;
        }
      }

      if (existingIndex >= 0) {
        rules.set(existingIndex, nextRule);
      } else {
        rules.add(nextRule);
      }

      userRepository.save(user);
      return ResponseEntity.ok(Map.of("msg", "Rule upserted", "customRules", user.getCustomRules()));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update rules", "error", ex.getMessage())
      );
    }
  }

  @DeleteMapping("/settings/rules")
  public ResponseEntity<?> removeRule(
      HttpServletRequest request,
      @RequestBody Map<String, Object> body
  ) {
    try {
      User user = resolveUser(request);

      String endpoint = String.valueOf(body.getOrDefault("endpoint", "")).trim();
      if (!endpoint.startsWith("/")) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Endpoint must start with '/'");
      }

      String method = String.valueOf(body.getOrDefault("method", "GET")).toUpperCase(Locale.ROOT);
      if (!ALLOWED_METHODS.contains(method)) {
        throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid HTTP method");
      }

      List<CustomRule> rules = user.getCustomRules() == null ? new ArrayList<>() : user.getCustomRules();
      rules.removeIf(rule -> {
        String ruleMethod = rule.getMethod() == null ? "GET" : rule.getMethod().toUpperCase(Locale.ROOT);
        return endpoint.equals(rule.getEndpoint()) && method.equals(ruleMethod);
      });
      user.setCustomRules(rules);
      userRepository.save(user);

      return ResponseEntity.ok(Map.of("msg", "Rule removed", "customRules", rules));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to remove rule", "error", ex.getMessage())
      );
    }
  }

  @GetMapping("/limiter-status")
  public ResponseEntity<?> limiterStatus(HttpServletRequest request) {
    resolveUser(request);
    return ResponseEntity.ok(Map.of("circuitBreaker", circuitBreakerService.status()));
  }

  private User resolveUser(HttpServletRequest request) {
    AuthUserContext context = authService.authenticate(request);
    return authService.findUserOrThrow(context.userId());
  }

  private Integer parsePositiveInt(Object value) {
    if (value == null) {
      return null;
    }
    try {
      int parsed = (int) Math.floor(Double.parseDouble(String.valueOf(value)));
      return parsed > 0 ? parsed : null;
    } catch (Exception ex) {
      return null;
    }
  }
}
