package com.apiratelimiter.config;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private String jwtSecret;
  private String corsOrigins;
  private String redisUrl;
  private boolean openBrowserOnStartup = true;
  private String startupPage = "/dashboard";

  public String getJwtSecret() {
    return jwtSecret;
  }

  public void setJwtSecret(String jwtSecret) {
    this.jwtSecret = jwtSecret;
  }

  public String getCorsOrigins() {
    return corsOrigins;
  }

  public void setCorsOrigins(String corsOrigins) {
    this.corsOrigins = corsOrigins;
  }

  public String getRedisUrl() {
    return redisUrl;
  }

  public void setRedisUrl(String redisUrl) {
    this.redisUrl = redisUrl;
  }

  public boolean isOpenBrowserOnStartup() {
    return openBrowserOnStartup;
  }

  public void setOpenBrowserOnStartup(boolean openBrowserOnStartup) {
    this.openBrowserOnStartup = openBrowserOnStartup;
  }

  public String getStartupPage() {
    return startupPage;
  }

  public void setStartupPage(String startupPage) {
    this.startupPage = startupPage;
  }

  public List<String> getCorsOriginList() {
    if (corsOrigins == null || corsOrigins.isBlank()) {
      return List.of();
    }
    return Arrays.stream(corsOrigins.split(","))
        .map(String::trim)
        .filter(origin -> !origin.isEmpty())
        .collect(Collectors.toList());
  }

  public boolean useInMemoryRedisMock() {
    return redisUrl != null && "memory".equalsIgnoreCase(redisUrl.trim());
  }
}
