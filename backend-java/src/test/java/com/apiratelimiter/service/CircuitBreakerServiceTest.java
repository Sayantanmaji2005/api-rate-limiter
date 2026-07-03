package com.apiratelimiter.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class CircuitBreakerServiceTest {

  private CircuitBreakerService service;

  @BeforeEach
  public void setUp() {
    service = new CircuitBreakerService();
  }

  @Test
  public void testInitialClosedState() {
    Map<String, Object> status = service.status();
    assertEquals("CLOSED", status.get("state"));
    assertEquals(0, status.get("failureCount"));
  }

  @Test
  public void testSuccessfulExecution() {
    String result = service.execute(
        () -> "success",
        ex -> "fallback"
    );
    assertEquals("success", result);
    assertEquals("CLOSED", service.status().get("state"));
  }

  @Test
  public void testTrippingToOpen() {
    // Perform 5 failing executions to trip the circuit breaker
    for (int i = 0; i < 5; i++) {
      String res = service.execute(
          () -> { throw new RuntimeException("fail"); },
          ex -> "fallback-" + ex.getMessage()
      );
      assertEquals("fallback-fail", res);
    }

    // After 5 failures, state should be OPEN
    assertEquals("OPEN", service.status().get("state"));
    assertEquals(5, service.status().get("failureCount"));

    // Subsequence call should immediately trigger fallback with null exception
    String immediateFallback = service.execute(
        () -> "will not run",
        ex -> "immediate-fallback"
    );
    assertEquals("immediate-fallback", immediateFallback);
  }

  @Test
  public void testSuccessResetsFailures() {
    // Fail 3 times
    for (int i = 0; i < 3; i++) {
      service.execute(
          () -> { throw new RuntimeException("fail"); },
          ex -> "fallback"
      );
    }
    assertEquals(3, service.status().get("failureCount"));

    // Execute successfully once
    service.execute(() -> "ok", ex -> "fallback");

    // Failure count should reset to 0
    assertEquals(0, service.status().get("failureCount"));
    assertEquals("CLOSED", service.status().get("state"));
  }
}
