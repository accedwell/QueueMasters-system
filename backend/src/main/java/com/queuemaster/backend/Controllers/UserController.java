package com.queuemaster.backend.Controllers;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Services.AppUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private AppUserRepository appUserRepository;

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
    public List<AppUser> getAllUsers() {
        return appUserRepository.findAll();
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody AppUser details) {
        Optional<AppUser> existing = appUserRepository.findById(id);
        if (existing.isEmpty()) return ResponseEntity.notFound().build();
        AppUser user = existing.get();

        if (details.getUsername() != null && !details.getUsername().trim().isEmpty()) {
            String name = details.getUsername().trim();
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
            user.setPassword(details.getPassword());
        }
        return ResponseEntity.ok(appUserRepository.save(user));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (isFounder(id)) {
            return ResponseEntity.badRequest().body("The founder account cannot be deleted.");
        }
        if (!appUserRepository.existsById(id)) return ResponseEntity.notFound().build();
        appUserRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
