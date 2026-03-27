package com.apiratelimiter.service;

import com.apiratelimiter.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final AppProperties appProperties;
  private volatile SecretKey signingKey;

  public JwtService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  public String issueToken(String userId) {
    Instant now = Instant.now();
    return Jwts.builder()
        .claim("id", userId)
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plus(1, ChronoUnit.DAYS)))
        .signWith(getSigningKey())
        .compact();
  }

  public String extractUserId(String token) {
    Claims claims = Jwts.parser()
        .verifyWith(getSigningKey())
        .build()
        .parseSignedClaims(token)
        .getPayload();
    Object id = claims.get("id");
    return id == null ? null : String.valueOf(id);
  }

  private SecretKey getSigningKey() {
    SecretKey local = signingKey;
    if (local != null) {
      return local;
    }

    synchronized (this) {
      if (signingKey == null) {
        signingKey = Keys.hmacShaKeyFor(toHmacKeyBytes(appProperties.getJwtSecret()));
      }
      return signingKey;
    }
  }

  private byte[] toHmacKeyBytes(String secret) {
    byte[] raw = (secret == null ? "" : secret).getBytes(StandardCharsets.UTF_8);
    if (raw.length >= 32) {
      return raw;
    }
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return digest.digest(raw);
    } catch (Exception ex) {
      return ("fallback-secret-value-for-hmac-signing-32-bytes-min")
          .getBytes(StandardCharsets.UTF_8);
    }
  }
}
