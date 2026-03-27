package com.apiratelimiter.model;

import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("users")
public class User {

  @Id
  private String id;

  @Indexed(unique = true)
  private String email;

  private String password;
  private Role role = Role.USER;
  private Tier tier = Tier.FREE;
  private RateLimitAlgorithm rateLimitAlgorithm = RateLimitAlgorithm.TOKEN_BUCKET;
  private List<CustomRule> customRules = new ArrayList<>();
  private List<String> whitelist = new ArrayList<>();
  private List<String> blacklist = new ArrayList<>();

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getEmail() {
    return email;
  }

  public void setEmail(String email) {
    this.email = email;
  }

  public String getPassword() {
    return password;
  }

  public void setPassword(String password) {
    this.password = password;
  }

  public Role getRole() {
    return role;
  }

  public void setRole(Role role) {
    this.role = role;
  }

  public Tier getTier() {
    return tier;
  }

  public void setTier(Tier tier) {
    this.tier = tier;
  }

  public RateLimitAlgorithm getRateLimitAlgorithm() {
    return rateLimitAlgorithm;
  }

  public void setRateLimitAlgorithm(RateLimitAlgorithm rateLimitAlgorithm) {
    this.rateLimitAlgorithm = rateLimitAlgorithm;
  }

  public List<CustomRule> getCustomRules() {
    return customRules;
  }

  public void setCustomRules(List<CustomRule> customRules) {
    this.customRules = customRules;
  }

  public List<String> getWhitelist() {
    return whitelist;
  }

  public void setWhitelist(List<String> whitelist) {
    this.whitelist = whitelist;
  }

  public List<String> getBlacklist() {
    return blacklist;
  }

  public void setBlacklist(List<String> blacklist) {
    this.blacklist = blacklist;
  }
}
