package com.queuemaster.backend;

import java.net.URI;
import java.util.Optional;

/**
 * Hosting platforms (Render, Railway, Heroku, Neon, Supabase...) hand out the database as one
 * {@code postgres://user:password@host:port/db?params} string called DATABASE_URL.
 * Spring/JDBC needs it split into a {@code jdbc:postgresql://...} URL plus username and password.
 * {@link BackendApplication#main} applies the result as system properties before Spring starts,
 * so it wins over the defaults in application.properties.
 */
public final class DatabaseUrl {

    public record Parts(String jdbcUrl, String username, String password) {}

    private DatabaseUrl() {}

    /** Returns the JDBC parts, or empty when the value is blank or not a postgres:// URL. */
    public static Optional<Parts> parse(String databaseUrl) {
        if (databaseUrl == null || databaseUrl.isBlank()) return Optional.empty();
        String value = databaseUrl.trim();
        if (value.startsWith("jdbc:")) {
            return Optional.of(new Parts(value, null, null));
        }
        if (!value.startsWith("postgres://") && !value.startsWith("postgresql://")) return Optional.empty();

        URI uri = URI.create(value);
        String user = null, pass = null;
        String userInfo = uri.getUserInfo();
        if (userInfo != null) {
            int colon = userInfo.indexOf(':');
            user = colon < 0 ? userInfo : userInfo.substring(0, colon);
            pass = colon < 0 ? null : userInfo.substring(colon + 1);
        }
        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(uri.getHost());
        if (uri.getPort() > 0) jdbc.append(':').append(uri.getPort());
        jdbc.append(uri.getPath() == null || uri.getPath().isEmpty() ? "/" : uri.getPath());
        if (uri.getQuery() != null && !uri.getQuery().isEmpty()) jdbc.append('?').append(uri.getRawQuery());
        return Optional.of(new Parts(jdbc.toString(), user, pass));
    }
}
