package com.limitr.config;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.limitr.domain.ApiClient;
import com.limitr.domain.RuleConfig;
import com.limitr.domain.enums.EnforcementState;
import com.limitr.service.AbuseDetectionService;
import com.limitr.service.ApiClientService;
import com.limitr.service.EnforcementService;
import com.limitr.service.RateLimitService;
import com.limitr.service.RequestLogService;
import com.limitr.service.RuleService;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class ApiProtectionFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-API-KEY";

    private final ApiClientService apiClientService;
    private final RuleService ruleService;
    private final RateLimitService rateLimitService;
    private final AbuseDetectionService abuseDetectionService;
    private final EnforcementService enforcementService;
    private final RequestLogService requestLogService;
    private final ObjectMapper objectMapper;

    public ApiProtectionFilter(
        ApiClientService apiClientService,
        RuleService ruleService,
        RateLimitService rateLimitService,
        AbuseDetectionService abuseDetectionService,
        EnforcementService enforcementService,
        RequestLogService requestLogService,
        ObjectMapper objectMapper
    ) {
        this.apiClientService = apiClientService;
        this.ruleService = ruleService;
        this.rateLimitService = rateLimitService;
        this.abuseDetectionService = abuseDetectionService;
        this.enforcementService = enforcementService;
        this.requestLogService = requestLogService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        boolean apiPath = "/api".equals(path) || path.startsWith("/api/");
        return !apiPath || path.startsWith("/api/public/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        Instant startedAt = Instant.now();
        String principalId = "anonymous:" + request.getRemoteAddr();
        int statusCode = HttpServletResponse.SC_OK;

        try {
            String apiKey = request.getHeader(API_KEY_HEADER);
            Optional<ApiClient> clientOptional = apiClientService.authenticate(apiKey);
            if (clientOptional.isEmpty()) {
                abuseDetectionService.recordFailedAuthAttempt(principalId);
                statusCode = HttpServletResponse.SC_UNAUTHORIZED;
                writeError(response, statusCode, "Invalid or missing API key.");
                return;
            }

            ApiClient client = clientOptional.get();
            principalId = client.getPrincipalId();

            RuleConfig ruleConfig = ruleService.getCurrentRule();
            EnforcementState state = enforcementService.evaluate(principalId, ruleConfig);
            if (state == EnforcementState.TEMP_BANNED || enforcementService.isTempBanned(principalId)) {
                statusCode = HttpServletResponse.SC_FORBIDDEN;
                writeError(response, statusCode, "This principal is temporarily banned.");
                return;
            }

            int limit = state == EnforcementState.THROTTLED
                ? ruleConfig.getThrottledLimitPerMinute()
                : ruleConfig.getBaseLimitPerMinute();
            RateLimitService.RateLimitDecision decision = rateLimitService.check(principalId, limit);
            setRateLimitHeaders(response, decision);

            if (!decision.allowed()) {
                abuseDetectionService.recordRateLimitExceeded(principalId);
                int score = abuseDetectionService.getScore(principalId);
                enforcementService.recordRateLimitIncident(principalId, score);
                enforcementService.evaluate(principalId, ruleConfig);
                statusCode = HttpStatus.TOO_MANY_REQUESTS.value();
                writeError(response, statusCode, "Rate limit exceeded.");
                return;
            }

            filterChain.doFilter(request, response);
            statusCode = response.getStatus();

            abuseDetectionService.recordRequest(principalId);
            Long resourceId = extractResourceId(request.getServletPath());
            if (resourceId != null) {
                abuseDetectionService.recordResourceAccess(principalId, resourceId);
            }
        } catch (Exception exception) {
            statusCode = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
            throw exception;
        } finally {
            long latency = Math.max(0, Instant.now().toEpochMilli() - startedAt.toEpochMilli());
            requestLogService.log(
                principalId,
                request.getRemoteAddr(),
                request.getMethod(),
                request.getServletPath(),
                statusCode,
                latency
            );
        }
    }

    private void setRateLimitHeaders(HttpServletResponse response, RateLimitService.RateLimitDecision decision) {
        response.setHeader("X-RateLimit-Limit", String.valueOf(decision.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(decision.remaining()));
        response.setHeader("Retry-After", String.valueOf(decision.retryAfterSeconds()));
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(objectMapper.writeValueAsString(Map.of("error", message)));
    }

    private Long extractResourceId(String path) {
        if (path == null || !path.startsWith("/api/resource/")) {
            return null;
        }
        String rawId = path.substring("/api/resource/".length());
        try {
            return Long.parseLong(rawId);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
