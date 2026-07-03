package com.apiratelimiter.service;

public class BucketState {

  private int tokens;
  private long lastRefill;

  public BucketState() {
  }

  public BucketState(int tokens, long lastRefill) {
    this.tokens = tokens;
    this.lastRefill = lastRefill;
  }

  public int getTokens() {
    return tokens;
  }

  public void setTokens(int tokens) {
    this.tokens = tokens;
  }

  public long getLastRefill() {
    return lastRefill;
  }

  public void setLastRefill(long lastRefill) {
    this.lastRefill = lastRefill;
  }
}
