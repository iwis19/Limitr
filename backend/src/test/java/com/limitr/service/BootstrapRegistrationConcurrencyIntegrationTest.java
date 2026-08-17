package com.limitr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.limitr.repository.AdminUserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
    "app.seed.enabled=false",
    "app.auth.registration-mode=bootstrap",
    "spring.datasource.url=jdbc:h2:mem:bootstrap-concurrency;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("h2")
@Import(BootstrapRegistrationConcurrencyIntegrationTest.BarrierConfiguration.class)
class BootstrapRegistrationConcurrencyIntegrationTest {

    private static final int CONTENDERS = 8;

    @Autowired
    private AuthService authService;

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Test
    void concurrentBootstrapRequestsCanCreateExactlyOneAdmin() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(CONTENDERS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<RegistrationResult>> registrations = new ArrayList<>();

        try {
            for (int i = 0; i < CONTENDERS; i++) {
                String username = "bootstrap-admin-" + i;
                registrations.add(executor.submit(() -> {
                    assertTrue(start.await(10, TimeUnit.SECONDS));
                    try {
                        authService.register(username, "password123");
                        return RegistrationResult.CREATED;
                    } catch (IllegalStateException exception) {
                        assertEquals("Admin registration is closed.", exception.getMessage());
                        return RegistrationResult.CLOSED;
                    }
                }));
            }

            start.countDown();

            List<RegistrationResult> results = new ArrayList<>();
            for (Future<RegistrationResult> registration : registrations) {
                results.add(registration.get(20, TimeUnit.SECONDS));
            }

            assertEquals(1, results.stream().filter(result -> result == RegistrationResult.CREATED).count());
            assertEquals(CONTENDERS - 1,
                results.stream().filter(result -> result == RegistrationResult.CLOSED).count());
            assertEquals(1, adminUserRepository.count());
        } finally {
            executor.shutdownNow();
        }
    }

    private enum RegistrationResult {
        CREATED,
        CLOSED
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class BarrierConfiguration {

        @Bean
        @Primary
        BarrierPasswordEncoder barrierPasswordEncoder() {
            return new BarrierPasswordEncoder(CONTENDERS);
        }
    }

    static class BarrierPasswordEncoder implements PasswordEncoder {

        private final CyclicBarrier barrier;

        BarrierPasswordEncoder(int parties) {
            this.barrier = new CyclicBarrier(parties);
        }

        @Override
        public String encode(CharSequence rawPassword) {
            try {
                barrier.await(10, TimeUnit.SECONDS);
                return "encoded-" + rawPassword;
            } catch (Exception exception) {
                throw new IllegalStateException("Bootstrap concurrency barrier failed.", exception);
            }
        }

        @Override
        public boolean matches(CharSequence rawPassword, String encodedPassword) {
            return ("encoded-" + rawPassword).equals(encodedPassword);
        }
    }
}
