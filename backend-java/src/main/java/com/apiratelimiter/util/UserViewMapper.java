package com.apiratelimiter.util;

import com.apiratelimiter.model.User;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class UserViewMapper {

  public Map<String, Object> toPublicUser(User user) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("_id", user.getId());
    map.put("email", user.getEmail());
    map.put("role", user.getRole() != null ? user.getRole().name() : null);
    map.put("tier", user.getTier() != null ? user.getTier().name() : null);
    map.put(
        "rateLimitAlgorithm",
        user.getRateLimitAlgorithm() != null ? user.getRateLimitAlgorithm().name() : null
    );
    map.put("customRules", user.getCustomRules());
    map.put("whitelist", user.getWhitelist());
    map.put("blacklist", user.getBlacklist());
    return map;
  }

  public Map<String, Object> toAdminUpgradeUser(User user) {
    Map<String, Object> map = new LinkedHashMap<>();
    map.put("_id", user.getId());
    map.put("email", user.getEmail());
    map.put("role", user.getRole() != null ? user.getRole().name() : null);
    map.put("tier", user.getTier() != null ? user.getTier().name() : null);
    map.put("whitelist", user.getWhitelist());
    map.put("blacklist", user.getBlacklist());
    return map;
  }
}
