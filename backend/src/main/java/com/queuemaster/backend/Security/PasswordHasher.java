package com.queuemaster.backend.Security;

import org.bouncycastle.crypto.generators.SCrypt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Set;

/**
 * Password hashing compatible with the Node.js API (frontend/server/security.cjs):
 * {@code scrypt:<salt hex>:<key hex>} with Node's defaults N=16384, r=8, p=1 and a 64-byte key.
 * Node passes the salt as its hex string, so the salt bytes are the UTF-8 bytes of that string.
 */
public final class PasswordHasher {

    private static final String PREFIX = "scrypt:";
    private static final int N = 16384, R = 8, P = 1, KEY_LENGTH = 64;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    /** Shared passwords that used to be the convention - no account may be given one again. */
    private static final Set<String> RETIRED = Set.of("admin@123", "staff@123");

    private PasswordHasher() {}

    public static String hash(String password) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        String saltHex = HEX.formatHex(salt);
        return PREFIX + saltHex + ":" + HEX.formatHex(derive(password, saltHex));
    }

    public static boolean verify(String password, String stored) {
        if (password == null || stored == null) return false;
        if (!isHashed(stored)) {
            // Legacy plaintext row: compare in constant time; callers upgrade it to a hash on success.
            return MessageDigest.isEqual(utf8(password), utf8(stored));
        }
        String[] parts = stored.split(":");
        if (parts.length != 3) return false;
        byte[] expected;
        try {
            expected = HEX.parseHex(parts[2]);
        } catch (IllegalArgumentException e) {
            return false;
        }
        return MessageDigest.isEqual(derive(password, parts[1]), expected);
    }

    public static boolean isHashed(String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }

    /** Returns why a new password is not acceptable, or null when it is fine. */
    public static String problemWith(String password) {
        if (password == null || password.length() < 8) return "Use at least 8 characters for the password.";
        if (password.length() > 128) return "Use 128 characters or fewer for the password.";
        if (RETIRED.contains(password.toLowerCase())) {
            return "That shared default password is no longer allowed. Choose one for this person only.";
        }
        return null;
    }

    private static byte[] derive(String password, String saltHex) {
        return SCrypt.generate(utf8(password), utf8(saltHex), N, R, P, KEY_LENGTH);
    }

    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }
}
