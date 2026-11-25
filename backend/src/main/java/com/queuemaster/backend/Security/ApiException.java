package com.queuemaster.backend.Security;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** An error with an HTTP status and a short message the frontend can show as-is. */
public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }

    @RestControllerAdvice
    static class Handler {
        @ExceptionHandler(ApiException.class)
        ResponseEntity<String> handle(ApiException e) {
            return ResponseEntity.status(e.getStatus()).body(e.getMessage());
        }
    }
}
