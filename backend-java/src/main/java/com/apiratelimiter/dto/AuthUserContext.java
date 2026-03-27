package com.apiratelimiter.dto;

import com.apiratelimiter.model.Role;

public record AuthUserContext(String userId, Role role, boolean authViaApiKey) {
}
