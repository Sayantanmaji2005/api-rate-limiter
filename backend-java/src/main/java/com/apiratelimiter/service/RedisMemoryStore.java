package com.apiratelimiter.service;

import com.apiratelimiter.config.AppProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.DefaultTypedTuple;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.stereotype.Service;

@Service
public class RedisMemoryStore {

  private final boolean memoryMode;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  private final Map<String, BucketState> memoryBuckets = new ConcurrentHashMap<>();
  private final Map<String, List<WindowEntry>> memoryWindows = new ConcurrentHashMap<>();
  private final Object memoryWindowLock = new Object();

  public RedisMemoryStore(
      AppProperties appProperties,
      StringRedisTemplate redisTemplate,
      ObjectMapper objectMapper
  ) {
    this.memoryMode = appProperties.useInMemoryRedisMock();
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
  }

  public BucketState getBucket(String key) {
    if (memoryMode) {
      return memoryBuckets.get(key);
    }
    String raw = redisTemplate.opsForValue().get(key);
    if (raw == null) {
      return null;
    }
    try {
      return objectMapper.readValue(raw, BucketState.class);
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Failed to parse bucket state", ex);
    }
  }

  public void setBucket(String key, BucketState state) {
    if (memoryMode) {
      memoryBuckets.put(key, state);
      return;
    }
    try {
      redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(state));
    } catch (JsonProcessingException ex) {
      throw new IllegalStateException("Failed to serialize bucket state", ex);
    }
  }

  public void removeWindowByScore(String key, long minInclusive, long maxInclusive) {
    if (memoryMode) {
      synchronized (memoryWindowLock) {
        List<WindowEntry> list = memoryWindows.computeIfAbsent(key, _key -> new ArrayList<>());
        list.removeIf(item -> item.score() >= minInclusive && item.score() <= maxInclusive);
      }
      return;
    }
    redisTemplate.opsForZSet().removeRangeByScore(key, minInclusive, maxInclusive);
  }

  public long windowCount(String key) {
    if (memoryMode) {
      synchronized (memoryWindowLock) {
        return memoryWindows.getOrDefault(key, List.of()).size();
      }
    }
    Long count = redisTemplate.opsForZSet().zCard(key);
    return count == null ? 0L : count;
  }

  public void addWindowEntries(String key, List<WindowEntry> entries) {
    if (entries.isEmpty()) {
      return;
    }
    if (memoryMode) {
      synchronized (memoryWindowLock) {
        List<WindowEntry> list = memoryWindows.computeIfAbsent(key, _key -> new ArrayList<>());
        list.addAll(entries);
        list.sort(Comparator.comparingLong(WindowEntry::score));
      }
      return;
    }
    Set<TypedTuple<String>> tuples = new LinkedHashSet<>();
    for (WindowEntry entry : entries) {
      tuples.add(new DefaultTypedTuple<>(entry.value(), (double) entry.score()));
    }
    redisTemplate.opsForZSet().add(key, tuples);
  }

  public WindowEntry getOldestWindowEntry(String key) {
    if (memoryMode) {
      synchronized (memoryWindowLock) {
        List<WindowEntry> list = memoryWindows.getOrDefault(key, List.of());
        return list.isEmpty() ? null : list.get(0);
      }
    }
    Set<TypedTuple<String>> oldestSet = redisTemplate.opsForZSet().rangeWithScores(key, 0, 0);
    if (oldestSet == null || oldestSet.isEmpty()) {
      return null;
    }
    TypedTuple<String> tuple = oldestSet.iterator().next();
    double score = tuple.getScore() == null ? 0 : tuple.getScore();
    return new WindowEntry((long) score, tuple.getValue());
  }

  public boolean isRedisHealthy() {
    if (memoryMode) {
      return true;
    }
    try {
      String ping = redisTemplate.execute((RedisConnection connection) -> connection.ping());
      return ping != null && ping.equalsIgnoreCase("PONG");
    } catch (DataAccessException ex) {
      return false;
    }
  }

  public boolean isMemoryMode() {
    return memoryMode;
  }
}
