package com.limitr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.limitr.domain.RequestLog;
import com.limitr.repository.RequestLogRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RequestLogServiceTest {

    @Test
    void appliesPrincipalAndStatusFiltersTogether() {
        RequestLogRepository repository = mock(RequestLogRepository.class);
        List<RequestLog> expected = List.of(new RequestLog());
        when(repository.findTop200ByPrincipalIdAndStatusCodeOrderByTimestampDesc("client-a", 429))
            .thenReturn(expected);

        List<RequestLog> actual = new RequestLogService(repository).findRecent("client-a", 429);

        assertEquals(expected, actual);
        verify(repository).findTop200ByPrincipalIdAndStatusCodeOrderByTimestampDesc("client-a", 429);
        verify(repository, never()).findTop200ByPrincipalIdOrderByTimestampDesc("client-a");
        verify(repository, never()).findTop200ByStatusCodeOrderByTimestampDesc(429);
    }

    @Test
    void countsAllRecentServerErrorsInTheDatabase() {
        RequestLogRepository repository = mock(RequestLogRepository.class);
        when(repository.countByTimestampAfterAndStatusCodeGreaterThanEqual(
            org.mockito.ArgumentMatchers.any(Instant.class),
            org.mockito.ArgumentMatchers.eq(500)
        )).thenReturn(275L);
        Instant before = Instant.now().minusSeconds(3600);

        long count = new RequestLogService(repository).serverErrorsLastHour();

        Instant after = Instant.now().minusSeconds(3600);
        assertEquals(275L, count);
        ArgumentCaptor<Instant> threshold = ArgumentCaptor.forClass(Instant.class);
        verify(repository).countByTimestampAfterAndStatusCodeGreaterThanEqual(threshold.capture(),
            org.mockito.ArgumentMatchers.eq(500));
        assertFalse(threshold.getValue().isBefore(before));
        assertFalse(threshold.getValue().isAfter(after));
        verify(repository, never()).findTop200ByOrderByTimestampDesc();
    }
}
