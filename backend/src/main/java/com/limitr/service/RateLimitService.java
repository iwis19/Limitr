package com.limitr.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {

    private static final int MAX_ATTEMPTS = 2;

    private final RateLimitWindowService rateLimitWindowService;

    public RateLimitService(RateLimitWindowService rateLimitWindowService) {
        this.rateLimitWindowService = rateLimitWindowService;
    }

    public RateLimitDecision check(String principalId, int limitPerMinute) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return rateLimitWindowService.checkInNewTransaction(principalId, limitPerMinute);
            } catch (DataIntegrityViolationException exception) {
                if (attempt == MAX_ATTEMPTS) {
                    throw exception;
                }
                // Two requests can both observe a missing first window. One insert
                // wins; retry the loser in a clean transaction so it locks that row.
            }
        }

        throw new IllegalStateException("Rate-limit decision could not be calculated.");
    }

    public record RateLimitDecision(
        boolean allowed,
        int limit,
        int remaining,
        long retryAfterSeconds
    ) {}
}
