package com.apiratelimiter.service;

import com.apiratelimiter.config.AppProperties;
import com.apiratelimiter.dto.LimiterResult;
import com.apiratelimiter.model.RateLimitAlgorithm;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

@Service
public class RedisMemoryStore {

  private static final String TOKEN_BUCKET_LUA =
      "local key = KEYS[1]\n" +
      "local capacity = tonumber(ARGV[1])\n" +
      "local refill_rate = tonumber(ARGV[2])\n" +
      "local cost = tonumber(ARGV[3])\n" +
      "local now = tonumber(ARGV[4])\n" +
      "\n" +
      "local bucket = redis.call('get', key)\n" +
      "local tokens\n" +
      "local last_refill\n" +
      "\n" +
      "if not bucket then\n" +
      "    tokens = capacity\n" +
      "    last_refill = now\n" +
      "else\n" +
      "    local data = cjson.decode(bucket)\n" +
      "    tokens = tonumber(data.tokens)\n" +
      "    last_refill = tonumber(data.lastRefill)\n" +
      "end\n" +
      "\n" +
      "local elapsed_seconds = math.floor((now - last_refill) / 1000)\n" +
      "if elapsed_seconds > 0 then\n" +
      "    local refill = elapsed_seconds * refill_rate\n" +
      "    local new_tokens = tokens + refill\n" +
      "    if new_tokens > capacity then new_tokens = capacity end\n" +
      "    tokens = new_tokens\n" +
      "    last_refill = last_refill + elapsed_seconds * 1000\n" +
      "    if tokens >= capacity then\n" +
      "        last_refill = now\n" +
      "    end\n" +
      "end\n" +
      "\n" +
      "local allowed = 0\n" +
      "if tokens >= cost then\n" +
      "    allowed = 1\n" +
      "    tokens = tokens - cost\n" +
      "end\n" +
      "\n" +
      "local next_state = { tokens = tokens, lastRefill = last_refill }\n" +
      "redis.call('set', key, cjson.encode(next_state))\n" +
      "\n" +
      "local token_deficit = cost - tokens\n" +
      "if token_deficit < 0 then token_deficit = 0 end\n" +
      "local retry_after = 0\n" +
      "if allowed == 0 then\n" +
      "    local safe_refill_rate = refill_rate\n" +
      "    if safe_refill_rate < 1 then safe_refill_rate = 1 end\n" +
      "    retry_after = math.ceil(token_deficit / safe_refill_rate)\n" +
      "end\n" +
      "\n" +
      "return { allowed, tokens, retry_after }";

  private static final String SLIDING_WINDOW_LUA =
      "local key = KEYS[1]\n" +
      "local limit = tonumber(ARGV[1])\n" +
      "local window_ms = tonumber(ARGV[2])\n" +
      "local cost = tonumber(ARGV[3])\n" +
      "local now = tonumber(ARGV[4])\n" +
      "local uuid_prefix = ARGV[5]\n" +
      "\n" +
      "redis.call('zremrangebyscore', key, 0, now - window_ms)\n" +
      "local current_count = redis.call('zcard', key)\n" +
      "\n" +
      "local allowed = 0\n" +
      "local remaining = limit - current_count\n" +
      "if current_count + cost <= limit then\n" +
      "    allowed = 1\n" +
      "    for i = 1, cost do\n" +
      "        local val = now .. '-' .. i .. '-' .. uuid_prefix\n" +
      "        redis.call('zadd', key, now, val)\n" +
      "    end\n" +
      "    remaining = remaining - cost\n" +
      "else\n" +
      "    if remaining < 0 then remaining = 0 end\n" +
      "end\n" +
      "\n" +
      "local retry_after = 0\n" +
      "if allowed == 0 then\n" +
      "    local oldest = redis.call('zrange', key, 0, 0, 'WITHSCORES')\n" +
      "    if oldest and #oldest >= 2 then\n" +
      "        local oldest_score = tonumber(oldest[2])\n" +
      "        local elapsed = now - oldest_score\n" +
      "        local diff = window_ms - elapsed\n" +
      "        local val = math.ceil(diff / 1000)\n" +
      "        if val < 1 then val = 1 end\n" +
      "        retry_after = val\n" +
      "    end\n" +
      "end\n" +
      "\n" +
      "return { allowed, remaining, retry_after }";

  private final boolean memoryMode;
  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;

  private final Map<String, BucketState> memoryBuckets = new ConcurrentHashMap<>();
  private final Map<String, List<WindowEntry>> memoryWindows = new ConcurrentHashMap<>();
  private final Object memoryLock = new Object();

  private final RedisScript<List> tokenBucketRedisScript;
  private final RedisScript<List> slidingWindowRedisScript;

  public RedisMemoryStore(
      AppProperties appProperties,
      StringRedisTemplate redisTemplate,
      ObjectMapper objectMapper
  ) {
    this.memoryMode = appProperties.useInMemoryRedisMock();
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;

    DefaultRedisScript<List> tbScript = new DefaultRedisScript<>();
    tbScript.setScriptText(TOKEN_BUCKET_LUA);
    tbScript.setResultType(List.class);
    this.tokenBucketRedisScript = tbScript;

    DefaultRedisScript<List> swScript = new DefaultRedisScript<>();
    swScript.setScriptText(SLIDING_WINDOW_LUA);
    swScript.setResultType(List.class);
    this.slidingWindowRedisScript = swScript;
  }

  public LimiterResult evaluateTokenBucket(String key, int capacity, int refillRate, int cost, long now) {
    if (memoryMode) {
      synchronized (memoryLock) {
        BucketState bucket = memoryBuckets.get(key);
        if (bucket == null) {
          bucket = new BucketState(capacity, now);
        }

        long elapsedSeconds = Math.floorDiv(now - bucket.getLastRefill(), 1000L);
        if (elapsedSeconds > 0) {
          int refill = (int) (elapsedSeconds * refillRate);
          bucket.setTokens(Math.min(capacity, bucket.getTokens() + refill));
          bucket.setLastRefill(bucket.getLastRefill() + elapsedSeconds * 1000L);
          if (bucket.getTokens() >= capacity) {
            bucket.setLastRefill(now);
          }
        }

        boolean allowed = bucket.getTokens() >= cost;
        if (allowed) {
          bucket.setTokens(bucket.getTokens() - cost);
        }
        memoryBuckets.put(key, bucket);

        int tokenDeficit = Math.max(cost - bucket.getTokens(), 0);
        int retryAfterSec = allowed
            ? 0
            : (int) Math.ceil((double) tokenDeficit / Math.max(refillRate, 1));

        LimiterResult result = new LimiterResult();
        result.setAllowed(allowed);
        result.setAlgorithm(RateLimitAlgorithm.TOKEN_BUCKET);
        result.setCost(cost);
        result.setRemaining(bucket.getTokens());
        result.setCapacity(capacity);
        result.setRefillRate(refillRate);
        result.setRetryAfterSec(retryAfterSec);
        return result;
      }
    }

    try {
      List<?> rawResult = redisTemplate.execute(
          tokenBucketRedisScript,
          List.of(key),
          String.valueOf(capacity),
          String.valueOf(refillRate),
          String.valueOf(cost),
          String.valueOf(now)
      );

      if (rawResult == null || rawResult.size() < 3) {
        throw new IllegalStateException("Redis Lua script returned invalid format");
      }

      boolean allowed = Long.parseLong(String.valueOf(rawResult.get(0))) == 1L;
      int remaining = Integer.parseInt(String.valueOf(rawResult.get(1)));
      int retryAfterSec = Integer.parseInt(String.valueOf(rawResult.get(2)));

      LimiterResult result = new LimiterResult();
      result.setAllowed(allowed);
      result.setAlgorithm(RateLimitAlgorithm.TOKEN_BUCKET);
      result.setCost(cost);
      result.setRemaining(remaining);
      result.setCapacity(capacity);
      result.setRefillRate(refillRate);
      result.setRetryAfterSec(retryAfterSec);
      return result;
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to evaluate token bucket via Redis", ex);
    }
  }

  public LimiterResult evaluateSlidingWindow(String key, int limit, int windowMs, int cost, long now) {
    if (memoryMode) {
      synchronized (memoryLock) {
        List<WindowEntry> list = memoryWindows.computeIfAbsent(key, _key -> new ArrayList<>());
        list.removeIf(item -> item.score() < now - windowMs);

        long countBefore = list.size();
        boolean allowed = countBefore + cost <= limit;

        long countAfter = countBefore;
        if (allowed) {
          for (int i = 0; i < cost; i++) {
            list.add(new WindowEntry(now, now + "-" + i + "-" + UUID.randomUUID().toString().substring(0, 6)));
          }
          list.sort(Comparator.comparingLong(WindowEntry::score));
          countAfter = countBefore + cost;
        }

        int retryAfterSec = 0;
        if (!allowed) {
          WindowEntry oldest = list.isEmpty() ? null : list.get(0);
          if (oldest != null) {
            long elapsed = now - oldest.score();
            retryAfterSec = Math.max((int) Math.ceil((double) (windowMs - elapsed) / 1000D), 1);
          }
        }

        LimiterResult result = new LimiterResult();
        result.setAllowed(allowed);
        result.setAlgorithm(RateLimitAlgorithm.SLIDING_WINDOW);
        result.setCost(cost);
        result.setRemaining(Math.max((int) (limit - countAfter), 0));
        result.setCapacity(limit);
        result.setRefillRate(null);
        result.setRetryAfterSec(retryAfterSec);
        return result;
      }
    }

    try {
      String uuidPrefix = UUID.randomUUID().toString().substring(0, 6);
      List<?> rawResult = redisTemplate.execute(
          slidingWindowRedisScript,
          List.of(key),
          String.valueOf(limit),
          String.valueOf(windowMs),
          String.valueOf(cost),
          String.valueOf(now),
          uuidPrefix
      );

      if (rawResult == null || rawResult.size() < 3) {
        throw new IllegalStateException("Redis Lua script returned invalid format");
      }

      boolean allowed = Long.parseLong(String.valueOf(rawResult.get(0))) == 1L;
      int remaining = Integer.parseInt(String.valueOf(rawResult.get(1)));
      int retryAfterSec = Integer.parseInt(String.valueOf(rawResult.get(2)));

      LimiterResult result = new LimiterResult();
      result.setAllowed(allowed);
      result.setAlgorithm(RateLimitAlgorithm.SLIDING_WINDOW);
      result.setCost(cost);
      result.setRemaining(remaining);
      result.setCapacity(limit);
      result.setRefillRate(null);
      result.setRetryAfterSec(retryAfterSec);
      return result;
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to evaluate sliding window via Redis", ex);
    }
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
