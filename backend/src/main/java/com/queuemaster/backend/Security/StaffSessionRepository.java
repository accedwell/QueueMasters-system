package com.queuemaster.backend.Security;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface StaffSessionRepository extends JpaRepository<StaffSession, String> {
    void deleteByUserId(Long userId);

    void deleteByExpiresAtBefore(Instant cutoff);
}
