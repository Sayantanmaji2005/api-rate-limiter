package com.apiratelimiter.config;

import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

  private static final List<String> DEFAULT_DEV_ORIGINS = List.of(
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
  );

  private final AppProperties appProperties;

  public CorsConfig(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    List<String> origins = appProperties.getCorsOriginList();
    if (origins.isEmpty()) {
      origins = DEFAULT_DEV_ORIGINS;
    }

    registry.addMapping("/**")
        .allowedOrigins(origins.toArray(String[]::new))
        .allowedMethods("*")
        .allowedHeaders("*");
  }
}
