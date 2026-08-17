package com.limitr.repository;

import com.limitr.domain.RequestLog;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RequestLogRepository extends JpaRepository<RequestLog, Long> {
    long countByTimestampAfter(Instant timestamp);
    long countByTimestampAfterAndStatusCodeGreaterThanEqual(Instant timestamp, Integer statusCode);
    List<RequestLog> findTop200ByOrderByTimestampDesc();
    List<RequestLog> findTop200ByPrincipalIdOrderByTimestampDesc(String principalId);
    List<RequestLog> findTop200ByStatusCodeOrderByTimestampDesc(Integer statusCode);
    List<RequestLog> findTop200ByPrincipalIdAndStatusCodeOrderByTimestampDesc(String principalId, Integer statusCode);
}
