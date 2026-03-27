package com.apiratelimiter.controller;

import com.apiratelimiter.dto.AuthUserContext;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.apiratelimiter.model.Role;
import com.apiratelimiter.model.Tier;
import com.apiratelimiter.model.User;
import com.apiratelimiter.repo.UserRepository;
import com.apiratelimiter.service.AnalyticsService;
import com.apiratelimiter.service.AuthService;
import com.apiratelimiter.util.AnalyticsViewMapper;
import com.apiratelimiter.util.UserViewMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.apache.commons.validator.routines.InetAddressValidator;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin")
public class AdminController {

  private static final Pattern OBJECT_ID_REGEX = Pattern.compile("^[a-fA-F0-9]{24}$");
  private static final InetAddressValidator IP_VALIDATOR = InetAddressValidator.getInstance();

  private final AuthService authService;
  private final UserRepository userRepository;
  private final AnalyticsService analyticsService;
  private final AnalyticsViewMapper analyticsViewMapper;
  private final UserViewMapper userViewMapper;

  public AdminController(
      AuthService authService,
      UserRepository userRepository,
      AnalyticsService analyticsService,
      AnalyticsViewMapper analyticsViewMapper,
      UserViewMapper userViewMapper
  ) {
    this.authService = authService;
    this.userRepository = userRepository;
    this.analyticsService = analyticsService;
    this.analyticsViewMapper = analyticsViewMapper;
    this.userViewMapper = userViewMapper;
  }

  @GetMapping("/users")
  public ResponseEntity<?> users(HttpServletRequest request) {
    try {
      requireAdmin(request);
      List<User> users = userRepository.findAll();
      users.sort((a, b) -> String.valueOf(a.getEmail()).compareToIgnoreCase(String.valueOf(b.getEmail())));
      List<Map<String, Object>> response = new ArrayList<>();
      for (User user : users) {
        response.add(userViewMapper.toPublicUser(user));
      }
      return ResponseEntity.ok(response);
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to load users", "error", ex.getMessage())
      );
    }
  }

  @GetMapping("/analytics")
  public ResponseEntity<?> analytics(
      HttpServletRequest request,
      @RequestParam(name = "userId", required = false) String userId
  ) {
    try {
      requireAdmin(request);
      return ResponseEntity.ok(
          analyticsViewMapper.toMapList(analyticsService.recentForAdmin(userId))
      );
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to load analytics", "error", ex.getMessage())
      );
    }
  }

  @GetMapping("/analytics/summary")
  public ResponseEntity<?> analyticsSummary(
      HttpServletRequest request,
      @RequestParam(name = "userId", required = false) String userId
  ) {
    try {
      requireAdmin(request);
      if (userId != null && !userId.isBlank() && !OBJECT_ID_REGEX.matcher(userId).matches()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid userId");
      }
      return ResponseEntity.ok(analyticsService.adminSummary(userId));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to load analytics summary", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/upgrade/{id}")
  public ResponseEntity<?> upgrade(
      HttpServletRequest request,
      @PathVariable("id") String userId,
      @RequestBody Map<String, Object> body
  ) {
    try {
      AuthUserContext context = authService.authenticate(request);
      User requester = authService.findUserOrThrow(context.userId());
      if (requester.getRole() != Role.ADMIN) {
        throw new ApiException(HttpStatus.FORBIDDEN, "Access denied: admins only");
      }

      String tierValue = String.valueOf(body.getOrDefault("tier", "")).trim().toUpperCase(Locale.ROOT);
      Tier tier;
      try {
        tier = Tier.valueOf(tierValue);
      } catch (Exception ex) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid tier value");
      }

      User user = userRepository.findById(userId)
          .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
      user.setTier(tier);
      user = userRepository.save(user);
      return ResponseEntity.ok(userViewMapper.toAdminUpgradeUser(user));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update tier", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/users/{id}/algorithm")
  public ResponseEntity<?> updateAlgorithm(
      HttpServletRequest request,
      @PathVariable("id") String userId,
      @RequestBody Map<String, Object> body
  ) {
    try {
      requireAdmin(request);
      String algorithmValue = String.valueOf(body.getOrDefault("algorithm", ""))
          .trim()
          .toUpperCase(Locale.ROOT);
      RateLimitAlgorithm algorithm;
      try {
        algorithm = RateLimitAlgorithm.valueOf(algorithmValue);
      } catch (Exception ex) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid algorithm");
      }

      User user = userRepository.findById(userId)
          .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
      user.setRateLimitAlgorithm(algorithm);
      user = userRepository.save(user);
      return ResponseEntity.ok(userViewMapper.toPublicUser(user));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update algorithm", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/users/{id}/whitelist")
  public ResponseEntity<?> whitelist(
      HttpServletRequest request,
      @PathVariable("id") String userId,
      @RequestBody Map<String, Object> body
  ) {
    try {
      requireAdmin(request);
      return ResponseEntity.ok(updateIpPolicy(userId, body, "whitelist"));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update whitelist", "error", ex.getMessage())
      );
    }
  }

  @PutMapping("/users/{id}/blacklist")
  public ResponseEntity<?> blacklist(
      HttpServletRequest request,
      @PathVariable("id") String userId,
      @RequestBody Map<String, Object> body
  ) {
    try {
      requireAdmin(request);
      return ResponseEntity.ok(updateIpPolicy(userId, body, "blacklist"));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to update blacklist", "error", ex.getMessage())
      );
    }
  }

  private User requireAdmin(HttpServletRequest request) {
    try {
      AuthUserContext context = authService.authenticate(request);
      User requester = authService.findUserOrThrow(context.userId());
      if (requester.getRole() != Role.ADMIN) {
        throw new ApiException(HttpStatus.FORBIDDEN, "Access denied: Admins only");
      }
      return requester;
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Admin check failed", "error", ex.getMessage())
      );
    }
  }

  private Map<String, Object> updateIpPolicy(String userId, Map<String, Object> body, String field) {
    String ip = String.valueOf(body.getOrDefault("ip", "")).trim();
    String action = String.valueOf(body.getOrDefault("action", "")).trim();

    if (ip.isBlank() || (!"add".equals(action) && !"remove".equals(action))) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Provide valid ip and action(add/remove)");
    }

    if (!IP_VALIDATOR.isValid(ip)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid IP format. Use IPv4 or IPv6.");
    }

    User user = userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));

    if ("whitelist".equals(field)) {
      List<String> whitelist = user.getWhitelist() == null ? new ArrayList<>() : user.getWhitelist();
      if ("add".equals(action) && !whitelist.contains(ip)) {
        whitelist.add(ip);
      }
      if ("remove".equals(action)) {
        whitelist.remove(ip);
      }
      user.setWhitelist(whitelist);
    } else {
      List<String> blacklist = user.getBlacklist() == null ? new ArrayList<>() : user.getBlacklist();
      if ("add".equals(action) && !blacklist.contains(ip)) {
        blacklist.add(ip);
      }
      if ("remove".equals(action)) {
        blacklist.remove(ip);
      }
      user.setBlacklist(blacklist);
    }

    user = userRepository.save(user);
    return userViewMapper.toPublicUser(user);
  }
}
