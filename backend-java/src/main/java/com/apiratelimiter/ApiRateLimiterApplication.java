package com.apiratelimiter;

import com.apiratelimiter.config.AppProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class ApiRateLimiterApplication {

  public static void main(String[] args) {
    SpringApplication.run(ApiRateLimiterApplication.class, args);
  }
}
