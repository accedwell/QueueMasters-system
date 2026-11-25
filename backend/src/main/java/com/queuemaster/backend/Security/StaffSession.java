package com.queuemaster.backend.Security;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;

/**
 * A signed-in staff member. Only the SHA-256 of the cookie token is stored, so a database leak
 * does not hand out live sessions. Same table as the Node.js API uses.
 */
@Entity
@Table(name = "qm_session", indexes = @Index(name = "qm_session_expiry", columnList = "expires_at"))
@Data
public class StaffSession {
    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
