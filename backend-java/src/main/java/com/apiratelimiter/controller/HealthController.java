package com.apiratelimiter.controller;

import com.apiratelimiter.service.RedisMemoryStore;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  private final MongoTemplate mongoTemplate;
  private final RedisMemoryStore store;

  public HealthController(MongoTemplate mongoTemplate, RedisMemoryStore store) {
    this.mongoTemplate = mongoTemplate;
    this.store = store;
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("status", "ok");
    response.put("uptimeSec", Math.floorDiv(ManagementFactory.getRuntimeMXBean().getUptime(), 1000L));
    response.put("timestamp", Instant.now().toString());

    Map<String, Object> services = new LinkedHashMap<>();
    services.put("mongo", isMongoUp() ? "up" : "down");
    services.put("redis", store.isRedisHealthy() ? "up" : "down");
    response.put("services", services);
    return response;
  }

  private boolean isMongoUp() {
    try {
      Document ping = mongoTemplate.executeCommand(new Document("ping", 1));
      Object ok = ping.get("ok");
      if (ok instanceof Number n) {
        return n.doubleValue() >= 1D;
      }
      return true;
    } catch (Exception ex) {
      return false;
    }
  }
}
