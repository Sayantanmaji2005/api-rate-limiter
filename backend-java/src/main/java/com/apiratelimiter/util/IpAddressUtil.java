package com.apiratelimiter.util;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Objects;
import org.springframework.stereotype.Component;

@Component
public class IpAddressUtil {

  public String resolveClientIp(HttpServletRequest request) {
    String forwardedFor = request.getHeader("X-Forwarded-For");
    if (forwardedFor != null && !forwardedFor.isBlank()) {
      String[] parts = forwardedFor.split(",");
      if (parts.length > 0) {
        return parts[0].trim();
      }
    }

    String realIp = request.getHeader("X-Real-IP");
    if (realIp != null && !realIp.isBlank()) {
      return realIp.trim();
    }

    return Objects.toString(request.getRemoteAddr(), "");
  }
}
