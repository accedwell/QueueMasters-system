package com.queuemaster.backend.Controllers;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Security.AuthService;
import com.queuemaster.backend.Security.PasswordHasher;
import com.queuemaster.backend.Services.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/** Staff management - every endpoint here is manager-only. */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository appUserRepository;
    private final AuthService auth;

    public UserController(AppUserRepository appUserRepository, AuthService auth) {
        this.appUserRepository = appUserRepository;
        this.auth = auth;
    }

    /** The founder is the first ADMIN ever created - protected from deletion and demotion. */
    private Optional<AppUser> founder() {
        return appUserRepository.findAll().stream()
                .filter(u -> "ADMIN".equals(u.getRole()))
                .min(Comparator.comparing(AppUser::getId));
    }

    private boolean isFounder(Long id) {
        return founder().map(f -> f.getId().equals(id)).orElse(false);
    }

    @GetMapping
    public List<AppUser> getAllUsers(HttpServletRequest request) {
        auth.requireAdmin(request);
        return appUserRepository.findAll();
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody AppUser details, HttpServletRequest request) {
        auth.requireAdmin(request);
        Optional<AppUser> existing = appUserRepository.findById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();
        AppUser user = existing.get();
        String oldRole = user.getRole();
        boolean passwordChanged = false;

        if (details.getUsername() != null && !details.getUsername().trim().isEmpty()) {
            String name = details.getUsername().trim();
            if (name.length() > 255) return ResponseEntity.badRequest().body("Username must be 255 characters or fewer.");
            Optional<AppUser> clash = appUserRepository.findByUsername(name);
            if (clash.isPresent() && !clash.get().getId().equals(id)) {
                return ResponseEntity.badRequest().body("Username already taken.");
            }
            user.setUsername(name);
        }
        if (details.getRole() != null) {
            String role = details.getRole().trim().toUpperCase();
            if (isFounder(id) && !role.equals("ADMIN")) {
                return ResponseEntity.badRequest().body("The founder account cannot be demoted.");
            }
            user.setRole(role.equals("ADMIN") ? "ADMIN" : "WASHER");
        }
        if (details.getPassword() != null && !details.getPassword().isEmpty()) {
            String problem = PasswordHasher.problemWith(details.getPassword());
            if (problem != null) return ResponseEntity.badRequest().body(problem);
            user.setPassword(PasswordHasher.hash(details.getPassword()));
            passwordChanged = true;
        }
        AppUser saved = appUserRepository.save(user);
        // A new password or role must take effect immediately, so sign that person out everywhere.
        if (passwordChanged || !saved.getRole().equals(oldRole)) auth.revokeAll(id);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id, HttpServletRequest request) {
        auth.requireAdmin(request);
        if (isFounder(id)) {
            return ResponseEntity.badRequest().body("The founder account cannot be deleted.");
        }
        if (!appUserRepository.existsById(id)) return ResponseEntity.notFound().build();
        auth.revokeAll(id);
        appUserRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
