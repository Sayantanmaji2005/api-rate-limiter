package com.apiratelimiter.repo;

import com.apiratelimiter.model.ApiKeyRecord;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ApiKeyRepository extends MongoRepository<ApiKeyRecord, String> {

  Optional<ApiKeyRecord> findByKey(String key);

  Optional<ApiKeyRecord> findByUserId(String userId);
}
