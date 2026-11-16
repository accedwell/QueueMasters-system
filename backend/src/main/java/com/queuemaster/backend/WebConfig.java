package com.queuemaster.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * Browser origins allowed to call the API, comma-separated.
     * Locally this defaults to the React dev server; in production set CORS_ALLOWED_ORIGINS
     * to the deployed frontend, e.g. https://queuemasters.vercel.app (several allowed, no trailing slash).
     */
    @Value("${cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.replaceAll("/+$", ""))
                .toArray(String[]::new);
        registry.addMapping("/api/**")
                // Patterns so a value like https://*.vercel.app also covers preview deployments.
                .allowedOriginPatterns(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }
}
