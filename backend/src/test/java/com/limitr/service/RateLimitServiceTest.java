package com.limitr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.limitr.domain.RateLimitWindow;
import com.limitr.repository.RateLimitWindowRepository;
import java.lang.reflect.Proxy;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class RateLimitServiceTest {

    @Test
    void fixedWindowCounterPersistsAcrossServiceInstances() {
        RateLimitWindowRepositoryFixture fixture = new RateLimitWindowRepositoryFixture();
        RateLimitService writer = new RateLimitService(new RateLimitWindowService(fixture.repository));
        RateLimitService reader = new RateLimitService(new RateLimitWindowService(fixture.repository));

        RateLimitService.RateLimitDecision first = writer.check("client-a", 2);
        RateLimitService.RateLimitDecision second = writer.check("client-a", 2);
        RateLimitService.RateLimitDecision third = reader.check("client-a", 2);

        assertTrue(first.allowed());
        assertEquals(1, first.remaining());
        assertTrue(second.allowed());
        assertEquals(0, second.remaining());
        assertFalse(third.allowed());
        assertEquals(2, fixture.onlyWindow().getRequestCount());
    }

    @Test
    void retriesFirstWindowInsertCollisionInACleanTransaction() {
        RateLimitService.RateLimitDecision expected = new RateLimitService.RateLimitDecision(true, 60, 59, 42);
        RetryOnceRateLimitWindowService windowService = new RetryOnceRateLimitWindowService(expected);

        RateLimitService.RateLimitDecision actual = new RateLimitService(windowService).check("client-a", 60);

        assertSame(expected, actual);
        assertEquals(2, windowService.attempts);
    }

    private static class RetryOnceRateLimitWindowService extends RateLimitWindowService {

        private final RateLimitService.RateLimitDecision decision;
        private int attempts;

        RetryOnceRateLimitWindowService(RateLimitService.RateLimitDecision decision) {
            super(null);
            this.decision = decision;
        }

        @Override
        public RateLimitService.RateLimitDecision checkInNewTransaction(String principalId, int limitPerMinute) {
            attempts++;
            if (attempts == 1) {
                throw new DataIntegrityViolationException("duplicate first window");
            }
            return decision;
        }
    }

    private static class RateLimitWindowRepositoryFixture {

        private final AtomicLong sequence = new AtomicLong();
        private final Map<String, RateLimitWindow> windows = new LinkedHashMap<>();
        private final RateLimitWindowRepository repository = createRepository();

        private RateLimitWindow onlyWindow() {
            return windows.values().iterator().next();
        }

        private RateLimitWindowRepository createRepository() {
            return (RateLimitWindowRepository) Proxy.newProxyInstance(
                RateLimitWindowRepository.class.getClassLoader(),
                new Class<?>[] { RateLimitWindowRepository.class },
                (proxy, method, args) -> {
                    return switch (method.getName()) {
                        case "findByPrincipalIdAndEpochMinute" -> {
                            String principalId = (String) args[0];
                            Long epochMinute = (Long) args[1];
                            yield Optional.ofNullable(windows.get(key(principalId, epochMinute)));
                        }
                        case "saveAndFlush" -> {
                            RateLimitWindow window = (RateLimitWindow) args[0];
                            if (window.getId() == null) {
                                window.setId(sequence.incrementAndGet());
                            }
                            windows.put(key(window.getPrincipalId(), window.getEpochMinute()), window);
                            yield window;
                        }
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        case "toString" -> "RateLimitWindowRepositoryTestProxy";
                        default -> throw new UnsupportedOperationException("Unexpected repository method: " + method.getName());
                    };
                }
            );
        }

        private String key(String principalId, Long epochMinute) {
            return principalId + ":" + epochMinute;
        }
    }
}
