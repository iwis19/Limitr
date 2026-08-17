package com.limitr.service;

import com.limitr.domain.RequestLog;
import com.limitr.repository.RequestLogRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RequestLogService {

    private final RequestLogRepository requestLogRepository;

    public RequestLogService(RequestLogRepository requestLogRepository) {
        this.requestLogRepository = requestLogRepository;
    }

    @Transactional
    public void log(
        String principalId,
        String ip,
        String method,
        String path,
        int statusCode,
        long latencyMs
    ) {
        RequestLog requestLog = new RequestLog();
        requestLog.setPrincipalId(principalId);
        requestLog.setIpAddress(ip);
        requestLog.setHttpMethod(method);
        requestLog.setPath(path);
        requestLog.setStatusCode(statusCode);
        requestLog.setLatencyMs(latencyMs);
        requestLogRepository.save(requestLog);
    }

    public long requestsPerMinute() {
        return requestLogRepository.countByTimestampAfter(Instant.now().minusSeconds(60));
    }

    public long serverErrorsLastHour() {
        return requestLogRepository.countByTimestampAfterAndStatusCodeGreaterThanEqual(
            Instant.now().minusSeconds(3600),
            500
        );
    }

    public List<RequestLog> findRecent(String principalId, Integer statusCode) {
        if (principalId != null && !principalId.isBlank()) {
            if (statusCode != null) {
                return requestLogRepository.findTop200ByPrincipalIdAndStatusCodeOrderByTimestampDesc(
                    principalId,
                    statusCode
                );
            }
            return requestLogRepository.findTop200ByPrincipalIdOrderByTimestampDesc(principalId);
        }
        if (statusCode != null) {
            return requestLogRepository.findTop200ByStatusCodeOrderByTimestampDesc(statusCode);
        }
        return requestLogRepository.findTop200ByOrderByTimestampDesc();
    }
}
