package com.apiratelimiter.dto;

import com.apiratelimiter.model.RateLimitAlgorithm;

public record RequestRule(
    RateLimitAlgorithm algorithm,
    int cost,
    int windowLimit,
    int windowMs
) {
}
