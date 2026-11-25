package com.queuemaster.backend.Controllers;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Security.AuthService;
import com.queuemaster.backend.Security.PasswordHasher;
import com.queuemaster.backend.Services.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AppUserRepository userRepository;
    private final AuthService auth;

    public AuthController(AppUserRepository userRepository, AuthService auth) {
        this.userRepository = userRepository;
        this.auth = auth;
    }

    /** Creating staff accounts is a manager-only action. */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody AppUser newUser, HttpServletRequest request) {
        auth.requireAdmin(request);
        if (isBlank(newUser.getUsername()) || isBlank(newUser.getPassword())) {
            return ResponseEntity.badRequest().body("Username and password are required.");
        }
        String problem = PasswordHasher.problemWith(newUser.getPassword());
        if (problem != null) return ResponseEntity.badRequest().body(problem);
        newUser.setUsername(newUser.getUsername().trim());
        if (newUser.getUsername().length() > 255) {
            return ResponseEntity.badRequest().body("Username must be 255 characters or fewer.");
        }
        if (userRepository.findByUsername(newUser.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists!");
        }
        String role = newUser.getRole() == null ? "WASHER" : newUser.getRole().trim().toUpperCase();
        newUser.setRole(role.equals("ADMIN") ? "ADMIN" : "WASHER");
        newUser.setPassword(PasswordHasher.hash(newUser.getPassword()));
        newUser.setId(null);
        return ResponseEntity.ok(userRepository.save(newUser));
    }

    @PostMapping("/login")
    public AppUser loginUser(@RequestBody AppUser loginRequest, HttpServletRequest request, HttpServletResponse response) {
        return auth.login(loginRequest.getUsername(), loginRequest.getPassword(), request, response);
    }

    @GetMapping("/me")
    public AppUser me(HttpServletRequest request) {
        return auth.requireStaff(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        auth.logout(request, response);
        return ResponseEntity.noContent().build();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
