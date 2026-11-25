package com.queuemaster.backend.Security;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Services.AppUser;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Server-side staff sessions in an HttpOnly cookie - the same scheme as the Node.js API, so the
 * React app behaves identically against either backend. The browser never sees a password or role
 * it could tamper with: every protected endpoint asks this service who is calling.
 */
@Service
public class AuthService {

    public static final String COOKIE = "qm_session";
    static final Duration SESSION_LIFETIME = Duration.ofDays(7);
    static final int MAX_LOGIN_ATTEMPTS = 15;
    static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);

    private static final Pattern TOKEN = Pattern.compile("^[a-f0-9]{64}$");
    private static final String REQUEST_USER = AuthService.class.getName() + ".user";
    // Verified against when the username does not exist, so timing does not reveal valid usernames.
    private static final String DUMMY_HASH = PasswordHasher.hash("not-a-real-password");

    private final AppUserRepository users;
    private final StaffSessionRepository sessions;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    private record Attempts(int count, Instant startedAt) {}

    public AuthService(AppUserRepository users, StaffSessionRepository sessions) {
        this.users = users;
        this.sessions = sessions;
    }

    /** The signed-in staff member, if the request carries a valid session cookie. */
    public Optional<AppUser> currentUser(HttpServletRequest request) {
        Object cached = request.getAttribute(REQUEST_USER);
        if (cached != null) return ((Optional<?>) cached).map(AppUser.class::cast);
        Optional<AppUser> user = token(request)
                .flatMap(t -> sessions.findById(sha256(t)))
                .filter(s -> s.getExpiresAt().isAfter(Instant.now()))
                .flatMap(s -> users.findById(s.getUserId()));
        request.setAttribute(REQUEST_USER, user);
        return user;
    }

    public AppUser requireStaff(HttpServletRequest request) {
        return currentUser(request).orElseThrow(() -> new ApiException(401, "Please sign in."));
    }

    public AppUser requireAdmin(HttpServletRequest request) {
        AppUser user = requireStaff(request);
        if (!"ADMIN".equals(user.getRole())) throw new ApiException(403, "Manager access required.");
        return user;
    }

    @Transactional
    public AppUser login(String username, String password, HttpServletRequest request, HttpServletResponse response) {
        if (username == null || username.isBlank() || password == null) {
            throw new ApiException(401, "Wrong username or password.");
        }
        String name = username.trim();
        String key = sha256(request.getRemoteAddr() + ":" + name.toLowerCase());
        if (recordAttempt(key) > MAX_LOGIN_ATTEMPTS) {
            throw new ApiException(429, "Too many sign-in attempts. Try again in 15 minutes.");
        }

        AppUser account = users.findByUsername(name).orElse(null);
        boolean ok = PasswordHasher.verify(password, account == null ? DUMMY_HASH : account.getPassword());
        if (account == null || !ok) throw new ApiException(401, "Wrong username or password.");
        attempts.remove(key);

        if (!PasswordHasher.isHashed(account.getPassword())) {
            account.setPassword(PasswordHasher.hash(password));
            users.save(account);
        }
        sessions.deleteByExpiresAtBefore(Instant.now());
        token(request).ifPresent(old -> sessions.deleteById(sha256(old)));

        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = HexFormat.of().formatHex(raw);
        StaffSession session = new StaffSession();
        session.setTokenHash(sha256(token));
        session.setUserId(account.getId());
        session.setExpiresAt(Instant.now().plus(SESSION_LIFETIME));
        sessions.save(session);

        setCookie(request, response, token, SESSION_LIFETIME);
        return account;
    }

    @Transactional
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        token(request).ifPresent(t -> sessions.deleteById(sha256(t)));
        setCookie(request, response, "", Duration.ZERO);
    }

    /** Signs a staff member out everywhere (after a password or role change, or deletion). */
    @Transactional
    public void revokeAll(Long userId) {
        sessions.deleteByUserId(userId);
    }

    private int recordAttempt(String key) {
        Instant now = Instant.now();
        if (attempts.size() > 10_000) {
            attempts.values().removeIf(a -> a.startedAt().isBefore(now.minus(ATTEMPT_WINDOW)));
        }
        return attempts.compute(key, (k, a) -> a == null || a.startedAt().isBefore(now.minus(ATTEMPT_WINDOW))
                ? new Attempts(1, now)
                : new Attempts(a.count() + 1, a.startedAt())).count();
    }

    private static Optional<String> token(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        for (Cookie c : cookies) {
            if (COOKIE.equals(c.getName()) && c.getValue() != null && TOKEN.matcher(c.getValue()).matches()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }

    private static void setCookie(HttpServletRequest request, HttpServletResponse response, String value, Duration age) {
        boolean https = request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        ResponseCookie cookie = ResponseCookie.from(COOKIE, value)
                .path("/api").httpOnly(true).sameSite("Strict").secure(https).maxAge(age).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
