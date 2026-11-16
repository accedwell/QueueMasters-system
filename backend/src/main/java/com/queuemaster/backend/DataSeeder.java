package com.queuemaster.backend;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Services.AppUser;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * On a brand-new database nobody could log in (registration is admin-only).
 * This creates a founder account the first time the system starts.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private final AppUserRepository users;

    public DataSeeder(AppUserRepository users) {
        this.users = users;
    }

    @Override
    public void run(String... args) {
        if (users.count() == 0) {
            AppUser admin = new AppUser();
            admin.setUsername("admin");
            admin.setPassword("admin@123");
            admin.setRole("ADMIN");
            users.save(admin);
            System.out.println(">>> QueueMasters: created default founder account admin / admin@123 - change it after first login.");
        }
    }
}
