package com.queuemaster.backend;

import com.queuemaster.backend.Security.PasswordHasher;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PasswordHasherTest {

    /** Produced by frontend/server/security.cjs hashPassword('Sh0wroom-Shine!'). */
    private static final String NODE_HASH = "scrypt:3b2b3f57f42900d170acecf4751f30ae:"
            + "ae52b93b6e0751be7b1efe3506683a8f8db324be5e5e8e11f07c49a02c337b10e1f8633cf4cc0ce9d3fa6b6ff4cbc3cdf38e0ac7c890944c41036c08c2be88e4";

    @Test
    void verifiesHashesMadeByTheNodeApi() {
        assertTrue(PasswordHasher.verify("Sh0wroom-Shine!", NODE_HASH));
        assertFalse(PasswordHasher.verify("sh0wroom-shine!", NODE_HASH));
    }

    @Test
    void hashesAreSaltedAndVerifiable() {
        String a = PasswordHasher.hash("correct horse");
        String b = PasswordHasher.hash("correct horse");
        assertTrue(a.startsWith("scrypt:"));
        assertNotEquals(a, b, "each hash gets its own salt");
        assertTrue(PasswordHasher.verify("correct horse", a));
        assertFalse(PasswordHasher.verify("wrong horse", a));
        assertFalse(PasswordHasher.verify(null, a));
        assertFalse(PasswordHasher.verify("x", "scrypt:broken"));
        assertFalse(PasswordHasher.verify("x", "scrypt:aa:not-hex"));
    }

    @Test
    void legacyPlainTextStillComparesSoItCanBeUpgraded() {
        assertTrue(PasswordHasher.verify("staff@123", "staff@123"));
        assertFalse(PasswordHasher.verify("staff@12", "staff@123"));
        assertFalse(PasswordHasher.isHashed("staff@123"));
    }

    @Test
    void rejectsShortAndRetiredSharedPasswords() {
        assertNotNull(PasswordHasher.problemWith("short"));
        assertNotNull(PasswordHasher.problemWith("staff@123"));
        assertNotNull(PasswordHasher.problemWith("ADMIN@123"));
        assertNull(PasswordHasher.problemWith("Thandi-washes-2026"));
    }
}
