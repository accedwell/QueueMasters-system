package com.queuemaster.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class BackendApplication {

    public static void main(String[] args) {
        applyDatabaseUrl(System.getenv("DATABASE_URL"));
        SpringApplication.run(BackendApplication.class, args);
    }

    /**
     * If the host provides a single DATABASE_URL (postgres://user:pass@host/db), split it into the
     * Spring datasource properties. System properties override application.properties, so the
     * DB_* defaults there only apply when DATABASE_URL is absent.
     */
    static void applyDatabaseUrl(String databaseUrl) {
        DatabaseUrl.parse(databaseUrl).ifPresent(parts -> {
            System.setProperty("spring.datasource.url", parts.jdbcUrl());
            if (parts.username() != null) System.setProperty("spring.datasource.username", parts.username());
            if (parts.password() != null) System.setProperty("spring.datasource.password", parts.password());
        });
    }

}
