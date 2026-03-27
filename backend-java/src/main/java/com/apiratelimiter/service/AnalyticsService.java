package com.apiratelimiter.service;

import com.apiratelimiter.model.AnalyticsEvent;
import com.apiratelimiter.repo.AnalyticsRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

@Service
public class AnalyticsService {

  private final AnalyticsRepository analyticsRepository;
  private final MongoTemplate mongoTemplate;

  public AnalyticsService(AnalyticsRepository analyticsRepository, MongoTemplate mongoTemplate) {
    this.analyticsRepository = analyticsRepository;
    this.mongoTemplate = mongoTemplate;
  }

  public void save(AnalyticsEvent event) {
    analyticsRepository.save(event);
  }

  public List<AnalyticsEvent> recentForUser(String userId) {
    return analyticsRepository.findTop20ByUserIdOrderByTimestampDesc(userId);
  }

  public List<AnalyticsEvent> recentForAdmin(String userId) {
    if (userId == null || userId.isBlank()) {
      return analyticsRepository.findTop100ByOrderByTimestampDesc();
    }
    return analyticsRepository.findTop100ByUserIdOrderByTimestampDesc(userId);
  }

  public Map<String, Object> userSummary(String userId) {
    Document match = new Document("userId", userId);
    Document summary = aggregateSummary(match);
    String topEndpoint = aggregateTopEndpoint(match);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("totalRequests", number(summary.get("totalRequests")));
    response.put("allowedRequests", number(summary.get("allowedRequests")));
    response.put("blockedRequests", number(summary.get("blockedRequests")));
    response.put("avgLatencyMs", round2(doubleNumber(summary.get("avgLatencyMs"))));
    response.put("totalCost", number(summary.get("totalCost")));
    response.put("topEndpoint", topEndpoint);
    return response;
  }

  public Map<String, Object> adminSummary(String userId) {
    Document match = new Document();
    if (userId != null && !userId.isBlank()) {
      match.append("userId", userId);
    }

    Document summary = aggregateAdminSummary(match);
    List<String> uniqueUsers = mongoTemplate
        .getCollection("analytics")
        .distinct("userId", match, String.class)
        .into(new ArrayList<>());

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("totalRequests", number(summary.get("totalRequests")));
    response.put("allowedRequests", number(summary.get("allowedRequests")));
    response.put("blockedRequests", number(summary.get("blockedRequests")));
    response.put("avgLatencyMs", round2(doubleNumber(summary.get("avgLatencyMs"))));
    response.put("impactedUsers", uniqueUsers.size());
    return response;
  }

  private Document aggregateSummary(Document match) {
    List<Document> pipeline = List.of(
        new Document("$match", match),
        new Document("$group", new Document("_id", null)
            .append("totalRequests", new Document("$sum", 1))
            .append("allowedRequests", new Document("$sum",
                new Document("$cond", List.of("$allowed", 1, 0))))
            .append("blockedRequests", new Document("$sum",
                new Document("$cond", List.of("$allowed", 0, 1))))
            .append("avgLatencyMs", new Document("$avg", "$latencyMs"))
            .append("totalCost", new Document("$sum",
                new Document("$ifNull", List.of("$cost", 0)))))
    );

    return firstOrEmpty(
        mongoTemplate.getCollection("analytics").aggregate(pipeline).into(new ArrayList<>())
    );
  }

  private Document aggregateAdminSummary(Document match) {
    List<Document> pipeline = List.of(
        new Document("$match", match),
        new Document("$group", new Document("_id", null)
            .append("totalRequests", new Document("$sum", 1))
            .append("allowedRequests", new Document("$sum",
                new Document("$cond", List.of("$allowed", 1, 0))))
            .append("blockedRequests", new Document("$sum",
                new Document("$cond", List.of("$allowed", 0, 1))))
            .append("avgLatencyMs", new Document("$avg", "$latencyMs")))
    );

    return firstOrEmpty(
        mongoTemplate.getCollection("analytics").aggregate(pipeline).into(new ArrayList<>())
    );
  }

  private String aggregateTopEndpoint(Document match) {
    List<Document> pipeline = List.of(
        new Document("$match", match),
        new Document("$group", new Document("_id", "$endpoint")
            .append("count", new Document("$sum", 1))),
        new Document("$sort", new Document("count", -1)),
        new Document("$limit", 1)
    );
    List<Document> result = mongoTemplate.getCollection("analytics")
        .aggregate(pipeline)
        .into(new ArrayList<>());
    if (result.isEmpty()) {
      return null;
    }
    return result.get(0).getString("_id");
  }

  private Document firstOrEmpty(List<Document> docs) {
    return docs.isEmpty() ? new Document() : docs.get(0);
  }

  private int number(Object value) {
    if (value instanceof Number numeric) {
      return numeric.intValue();
    }
    return 0;
  }

  private double doubleNumber(Object value) {
    if (value instanceof Number numeric) {
      return numeric.doubleValue();
    }
    return 0D;
  }

  private double round2(double value) {
    return Math.round(value * 100D) / 100D;
  }
}
