package com.apiratelimiter.service;

import com.apiratelimiter.dto.AuthUserContext;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.Role;
import com.apiratelimiter.model.User;
import com.apiratelimiter.repo.ApiKeyRepository;
import com.apiratelimiter.repo.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

  private final JwtService jwtService;
  private final ApiKeyRepository apiKeyRepository;
  private final UserRepository userRepository;

  public AuthService(
      JwtService jwtService,
      ApiKeyRepository apiKeyRepository,
      UserRepository userRepository
  ) {
    this.jwtService = jwtService;
    this.apiKeyRepository = apiKeyRepository;
    this.userRepository = userRepository;
  }

  public AuthUserContext authenticate(HttpServletRequest request) {
    String authHeader = Optional.ofNullable(request.getHeader("Authorization")).orElse("");
    String bearerToken = authHeader.startsWith("Bearer ")
        ? authHeader.substring(7)
        : authHeader;

    if (!bearerToken.isBlank()) {
      try {
        String userId = jwtService.extractUserId(bearerToken.trim());
        if (userId != null && !userId.isBlank()) {
          return new AuthUserContext(userId, null, false);
        }
      } catch (Exception ignored) {
        // Fall through to API key check.
      }
    }

    String apiKey = Optional.ofNullable(request.getHeader("x-api-key")).orElse("").trim();
    if (!apiKey.isEmpty()) {
      var record = apiKeyRepository.findByKey(apiKey)
          .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid API key"));
      User user = userRepository.findById(record.getUserId())
          .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "API key owner not found"));
      return new AuthUserContext(user.getId(), user.getRole(), true);
    }

    throw new ApiException(HttpStatus.UNAUTHORIZED, "No valid token or API key");
  }

  public User findUserOrThrow(String userId) {
    return userRepository.findById(userId)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
  }

  public User requireAdmin(HttpServletRequest request) {
    AuthUserContext context = authenticate(request);
    User requester = userRepository.findById(context.userId())
        .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Access denied: Admins only"));
    if (requester.getRole() != Role.ADMIN) {
      throw new ApiException(HttpStatus.FORBIDDEN, "Access denied: Admins only");
    }
    return requester;
  }
}
