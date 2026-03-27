package com.apiratelimiter.model;

public class CustomRule {

  private String endpoint;
  private String method = "GET";
  private Integer cost = 1;
  private Integer windowLimit;
  private Integer windowMs;

  public String getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(String endpoint) {
    this.endpoint = endpoint;
  }

  public String getMethod() {
    return method;
  }

  public void setMethod(String method) {
    this.method = method;
  }

  public Integer getCost() {
    return cost;
  }

  public void setCost(Integer cost) {
    this.cost = cost;
  }

  public Integer getWindowLimit() {
    return windowLimit;
  }

  public void setWindowLimit(Integer windowLimit) {
    this.windowLimit = windowLimit;
  }

  public Integer getWindowMs() {
    return windowMs;
  }

  public void setWindowMs(Integer windowMs) {
    this.windowMs = windowMs;
  }
}
