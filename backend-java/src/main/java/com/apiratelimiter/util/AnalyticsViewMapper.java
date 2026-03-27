package com.apiratelimiter.util;

import com.apiratelimiter.model.AnalyticsEvent;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class AnalyticsViewMapper {

  public Map<String, Object> toMap(AnalyticsEvent event) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("_id", event.getId());
    map.put("userId", event.getUserId());
    map.put("endpoint", event.getEndpoint());
    map.put("method", event.getMethod());
    map.put("algorithm", event.getAlgorithm());
    map.put("cost", event.getCost());
    map.put("allowed", event.isAllowed());
    map.put("reason", event.getReason());
    map.put("ip", event.getIp());
    map.put("userAgent", event.getUserAgent());
    map.put("latencyMs", event.getLatencyMs());
    map.put("expiresAt", event.getExpiresAt());
    map.put("timestamp", event.getTimestamp());
    return map;
  }

  public List<Map<String, Object>> toMapList(List<AnalyticsEvent> events) {
    return events.stream().map(this::toMap).collect(Collectors.toList());
  }
}
