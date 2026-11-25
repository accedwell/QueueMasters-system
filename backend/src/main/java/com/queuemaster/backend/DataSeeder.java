package com.queuemaster.backend;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Security.PasswordHasher;
import com.queuemaster.backend.Services.AppUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Runs once at startup:
 * 1. On a brand-new database nobody could log in (registration is admin-only), so a founder account is created.
 * 2. Any password still stored as plain text (from older versions) is replaced by its scrypt hash.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository users;
    private final String initialAdminPassword;

    public DataSeeder(AppUserRepository users,
                      @Value("${INITIAL_ADMIN_PASSWORD:admin@123}") String initialAdminPassword) {
        this.users = users;
        this.initialAdminPassword = initialAdminPassword;
    }

    @Override
    public void run(String... args) {
        if (users.count() == 0) {
            AppUser admin = new AppUser();
            admin.setUsername("admin");
            admin.setPassword(PasswordHasher.hash(initialAdminPassword));
            admin.setRole("ADMIN");
            users.save(admin);
            System.out.println(">>> QueueMasters: created founder account 'admin' (password from INITIAL_ADMIN_PASSWORD,"
                    + " or admin@123 if unset) - change it under Staff after the first login.");
        }

        int upgraded = 0;
        for (AppUser user : users.findAll()) {
            if (!PasswordHasher.isHashed(user.getPassword())) {
                user.setPassword(PasswordHasher.hash(user.getPassword()));
                users.save(user);
                upgraded++;
            }
        }
        if (upgraded > 0) {
            System.out.println(">>> QueueMasters: secured " + upgraded + " plain-text password(s) with scrypt hashing.");
        }
    }
}
