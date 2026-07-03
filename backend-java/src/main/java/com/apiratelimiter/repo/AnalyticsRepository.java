package com.apiratelimiter.repo;

import com.apiratelimiter.model.AnalyticsEvent;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AnalyticsRepository extends MongoRepository<AnalyticsEvent, String> {

  List<AnalyticsEvent> findTop20ByUserIdOrderByTimestampDesc(String userId);

  List<AnalyticsEvent> findTop100ByOrderByTimestampDesc();

  List<AnalyticsEvent> findTop100ByUserIdOrderByTimestampDesc(String userId);
}
