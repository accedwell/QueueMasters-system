package com.queuemaster.backend;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseUrlTest {

    @Test
    void parsesRenderStyleUrl() {
        var parts = DatabaseUrl.parse("postgresql://queuemasters:s3cret@dpg-abc123-a.oregon-postgres.render.com:5432/queuemasters").orElseThrow();
        assertEquals("jdbc:postgresql://dpg-abc123-a.oregon-postgres.render.com:5432/queuemasters", parts.jdbcUrl());
        assertEquals("queuemasters", parts.username());
        assertEquals("s3cret", parts.password());
    }

    @Test
    void parsesInternalUrlWithoutPortAndKeepsQueryParams() {
        var parts = DatabaseUrl.parse("postgres://u:p@dpg-abc123-a/db?sslmode=require").orElseThrow();
        assertEquals("jdbc:postgresql://dpg-abc123-a/db?sslmode=require", parts.jdbcUrl());
        assertEquals("u", parts.username());
        assertEquals("p", parts.password());
    }

    @Test
    void decodesPercentEncodedPassword() {
        var parts = DatabaseUrl.parse("postgres://u:p%40ss%23word@host/db").orElseThrow();
        assertEquals("p@ss#word", parts.password());
    }

    @Test
    void passesJdbcUrlsThroughUnchanged() {
        var parts = DatabaseUrl.parse("jdbc:postgresql://localhost:5432/queuemasters").orElseThrow();
        assertEquals("jdbc:postgresql://localhost:5432/queuemasters", parts.jdbcUrl());
        assertNull(parts.username());
    }

    @Test
    void ignoresBlankOrForeignValues() {
        assertTrue(DatabaseUrl.parse(null).isEmpty());
        assertTrue(DatabaseUrl.parse("   ").isEmpty());
        assertTrue(DatabaseUrl.parse("mysql://u:p@host/db").isEmpty());
    }
}
