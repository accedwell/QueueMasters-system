package com.queuemaster.backend.Controllers;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Services.AppUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AppUserRepository userRepository;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody AppUser newUser) {
        if (isBlank(newUser.getUsername()) || isBlank(newUser.getPassword())) {
            return ResponseEntity.badRequest().body("Username and password are required.");
        }
        newUser.setUsername(newUser.getUsername().trim());
        if (userRepository.findByUsername(newUser.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists!");
        }
        String role = newUser.getRole() == null ? "WASHER" : newUser.getRole().trim().toUpperCase();
        newUser.setRole(role.equals("ADMIN") ? "ADMIN" : "WASHER");
        newUser.setId(null);
        return ResponseEntity.ok(userRepository.save(newUser));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody AppUser loginRequest) {
        if (isBlank(loginRequest.getUsername()) || loginRequest.getPassword() == null) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }
        AppUser user = userRepository.findByUsername(loginRequest.getUsername().trim()).orElse(null);
        if (user != null && user.getPassword().equals(loginRequest.getPassword())) {
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.status(401).body("Invalid credentials");
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
