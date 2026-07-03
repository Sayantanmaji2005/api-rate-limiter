package com.apiratelimiter.config;

import com.apiratelimiter.annotation.RateLimited;
import com.apiratelimiter.dto.AuthUserContext;
import com.apiratelimiter.dto.RateLimitDecision;
import com.apiratelimiter.exception.ApiException;
import com.apiratelimiter.model.User;
import com.apiratelimiter.service.AuthService;
import com.apiratelimiter.service.RateLimiterService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class RateLimiterInterceptor implements HandlerInterceptor {

  private final AuthService authService;
  private final RateLimiterService rateLimiterService;
  private final ObjectMapper objectMapper;

  public RateLimiterInterceptor(
      AuthService authService,
      RateLimiterService rateLimiterService,
      ObjectMapper objectMapper
  ) {
    this.authService = authService;
    this.rateLimiterService = rateLimiterService;
    this.objectMapper = objectMapper;
  }

  @Override
  public boolean preHandle(
      HttpServletRequest request,
      HttpServletResponse response,
      Object handler
  ) throws Exception {
    if (!(handler instanceof HandlerMethod)) {
      return true;
    }

    HandlerMethod handlerMethod = (HandlerMethod) handler;
    if (!handlerMethod.hasMethodAnnotation(RateLimited.class)) {
      return true;
    }

    try {
      AuthUserContext context = authService.authenticate(request);
      User user = authService.findUserOrThrow(context.userId());
      RateLimitDecision decision = rateLimiterService.evaluate(request, user);

      // Write rate limit headers to response in either case (allowed/blocked)
      decision.getHeaders().forEach((key, values) -> {
        for (String val : values) {
          response.addHeader(key, val);
        }
      });

      if (!decision.isAllowed()) {
        sendErrorResponse(response, decision.getErrorStatus(), decision.getErrorBody());
        return false;
      }

      request.setAttribute("rateLimitDecision", decision);
      return true;
    } catch (ApiException ex) {
      sendErrorResponse(response, ex.getStatus(), Map.of("msg", ex.getMessage()));
      return false;
    } catch (Exception ex) {
      sendErrorResponse(
          response,
          HttpStatus.INTERNAL_SERVER_ERROR,
          Map.of("msg", "Rate limiting error", "error", ex.getMessage())
      );
      return false;
    }
  }

  private void sendErrorResponse(
      HttpServletResponse response,
      HttpStatus status,
      Object body
  ) throws IOException {
    response.setStatus(status.value());
    response.setContentType("application/json");
    response.setCharacterEncoding("UTF-8");
    response.getWriter().write(objectMapper.writeValueAsString(body));
  }
}
