package com.apiratelimiter.controller;

import com.apiratelimiter.dto.AuthUserContext;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.ApiKeyRecord;
import com.apiratelimiter.model.User;
import com.apiratelimiter.repo.ApiKeyRepository;
import com.apiratelimiter.repo.UserRepository;
import com.apiratelimiter.service.AuthService;
import com.apiratelimiter.service.JwtService;
import com.apiratelimiter.util.UserViewMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

  private static final Pattern EMAIL_REGEX = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final UserRepository userRepository;
  private final ApiKeyRepository apiKeyRepository;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final AuthService authService;
  private final UserViewMapper userViewMapper;

  public AuthController(
      UserRepository userRepository,
      ApiKeyRepository apiKeyRepository,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      AuthService authService,
      UserViewMapper userViewMapper
  ) {
    this.userRepository = userRepository;
    this.apiKeyRepository = apiKeyRepository;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.authService = authService;
    this.userViewMapper = userViewMapper;
  }

  @PostMapping("/register")
  public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body) {
    try {
      String email = normalizeEmail(body.get("email"));
      String password = String.valueOf(body.getOrDefault("password", ""));

      if (email.isBlank() || password.isBlank()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Email and password are required");
      }
      if (!EMAIL_REGEX.matcher(email).matches()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email format");
      }
      if (password.length() < 8) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
      }

      if (userRepository.findByEmail(email).isPresent()) {
        throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
      }

      User user = new User();
      user.setEmail(email);
      user.setPassword(passwordEncoder.encode(password));
      user = userRepository.save(user);

      ApiKeyRecord record = new ApiKeyRecord();
      record.setUserId(user.getId());
      record.setKey(generateApiKey());
      record.setCreatedAt(Instant.now());
      apiKeyRepository.save(record);

      return ResponseEntity.ok(Map.of("message", "Registered", "apiKey", record.getKey()));
    } catch (ApiException ex) {
      throw ex;
    } catch (DuplicateKeyException ex) {
      throw new ApiException(HttpStatus.CONFLICT, "Email already registered");
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          Map.of("msg", "Registration failed", "error", ex.getMessage())
      );
    }
  }

  @PostMapping("/login")
  public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> body) {
    try {
      String email = normalizeEmail(body.get("email"));
      String password = String.valueOf(body.getOrDefault("password", ""));

      if (email.isBlank() || password.isBlank()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Email and password are required");
      }
      if (!EMAIL_REGEX.matcher(email).matches()) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid email format");
      }

      User user = userRepository.findByEmail(email)
          .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Invalid credentials"));

      if (!passwordEncoder.matches(password, user.getPassword())) {
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid credentials");
      }

      String token = jwtService.issueToken(user.getId());
      return ResponseEntity.ok(Map.of("token", token));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Login failed", "error", ex.getMessage())
      );
    }
  }

  @GetMapping("/me")
  public ResponseEntity<Map<String, Object>> me(HttpServletRequest request) {
    try {
      AuthUserContext context = authService.authenticate(request);
      User user = userRepository.findById(context.userId()).orElse(null);
      ApiKeyRecord apiKey = apiKeyRepository.findByUserId(context.userId()).orElse(null);

      Map<String, Object> response = new LinkedHashMap<>();
      response.put("user", user == null ? null : userViewMapper.toPublicUser(user));
      response.put("apiKey", apiKey == null ? null : apiKey.getKey());
      return ResponseEntity.ok(response);
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Server Error");
    }
  }

  @PostMapping("/rotate-api-key")
  public ResponseEntity<Map<String, Object>> rotateApiKey(HttpServletRequest request) {
    try {
      AuthUserContext context = authService.authenticate(request);
      ApiKeyRecord record = apiKeyRepository.findByUserId(context.userId()).orElseGet(() -> {
        ApiKeyRecord created = new ApiKeyRecord();
        created.setUserId(context.userId());
        created.setCreatedAt(Instant.now());
        return created;
      });
      record.setKey(generateApiKey());
      record = apiKeyRepository.save(record);
      return ResponseEntity.ok(Map.of("msg", "API key rotated", "apiKey", record.getKey()));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Failed to rotate API key", "error", ex.getMessage())
      );
    }
  }

  private String normalizeEmail(Object value) {
    return String.valueOf(value == null ? "" : value).trim().toLowerCase(Locale.ROOT);
  }

  private String generateApiKey() {
    byte[] bytes = new byte[32];
    SECURE_RANDOM.nextBytes(bytes);
    StringBuilder builder = new StringBuilder(64);
    for (byte b : bytes) {
      builder.append(String.format("%02x", b));
    }
    return builder.toString();
  }
}
