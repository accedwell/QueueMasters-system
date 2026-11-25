package com.queuemaster.backend;

import com.queuemaster.backend.Repositories.AppUserRepository;
import com.queuemaster.backend.Services.AppUser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityTest {

    @Autowired MockMvc mvc;
    @Autowired AppUserRepository users;
    @Autowired DataSeeder seeder;

    private static String creds(String username, String password) {
        return "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    }

    private Cookie login(String username, String password) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(creds(username, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.password").doesNotExist())
                .andReturn();
        String header = r.getResponse().getHeader("Set-Cookie");
        assertNotNull(header);
        assertTrue(header.contains("HttpOnly") && header.contains("SameSite=Strict") && header.contains("Path=/api"), header);
        String pair = header.split(";")[0];
        return new Cookie("qm_session", pair.substring(pair.indexOf('=') + 1));
    }

    private Cookie admin() throws Exception {
        return login("admin", "admin@123");
    }

    private Long createWasher(Cookie admin, String name, String password) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/register").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + name + "\",\"password\":\"" + password + "\",\"role\":\"WASHER\"}"))
                .andExpect(status().isOk()).andReturn();
        return users.findByUsername(name).orElseThrow().getId();
    }

    @Test
    void anonymousCallersCannotReachStaffOrAdminEndpoints() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"intruder\",\"password\":\"Intruder-2026\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/bookings/all-sales")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/bookings/daily-total")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/bookings/clear-archive")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/bookings/1/next")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/bookings/1/complete")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/users/1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users").cookie(new Cookie("qm_session", "f".repeat(64)))).andExpect(status().isUnauthorized());
        assertTrue(users.findByUsername("intruder").isEmpty());
    }

    @Test
    void passwordsAreHashedAndWrongPasswordsRejected() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(creds("admin", "wrong")))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(creds("nobody", "whatever1")))
                .andExpect(status().isUnauthorized());
        Cookie admin = admin();
        mvc.perform(get("/api/auth/me").cookie(admin)).andExpect(jsonPath("$.username").value("admin"));
        assertTrue(users.findByUsername("admin").orElseThrow().getPassword().startsWith("scrypt:"));

        createWasher(admin, "hashcheck", "Hash-Check-2026");
        assertTrue(users.findByUsername("hashcheck").orElseThrow().getPassword().startsWith("scrypt:"));
        mvc.perform(get("/api/users").cookie(admin))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("scrypt"))))
                .andExpect(content().string(not(containsString("password"))));
    }

    @Test
    void weakAndSharedPasswordsAreRefused() throws Exception {
        Cookie admin = admin();
        for (String bad : new String[]{"staff@123", "short"}) {
            mvc.perform(post("/api/auth/register").cookie(admin).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"weak\",\"password\":\"" + bad + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        Long id = createWasher(admin, "weakedit", "Weak-Edit-2026");
        mvc.perform(put("/api/users/" + id).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"admin@123\"}")).andExpect(status().isBadRequest());
    }

    @Test
    void washersCanWorkTheQueueButNotManage() throws Exception {
        Cookie admin = admin();
        createWasher(admin, "sipho", "Sipho-Washes-2026");
        Cookie washer = login("sipho", "Sipho-Washes-2026");

        mvc.perform(get("/api/users").cookie(washer)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/register").cookie(washer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"x\",\"password\":\"Promote-Me-2026\",\"role\":\"ADMIN\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/bookings/clear-archive").cookie(washer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/bookings/all-sales").cookie(washer)).andExpect(status().isOk());

        // A customer books without logging in; price and status come from the server, not the request.
        MvcResult booked = mvc.perform(post("/api/bookings").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"plateNumber\":\" sec 001 \",\"washType\":\"Full Valet\",\"phoneNumber\":\"0712345678\",\"amountPaid\":1,\"status\":\"Ready\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plateNumber").value("SEC 001"))
                .andExpect(jsonPath("$.amountPaid").value(350.0))
                .andExpect(jsonPath("$.status").value("In Queue"))
                .andReturn();
        String id = booked.getResponse().getContentAsString().replaceAll(".*\"id\":(\\d+).*", "$1");

        mvc.perform(get("/api/bookings"))
                .andExpect(jsonPath("$[?(@.plateNumber=='SEC 001')].phoneNumber").isEmpty())
                .andExpect(content().string(not(containsString("0712345678"))));
        mvc.perform(get("/api/bookings").cookie(washer))
                .andExpect(jsonPath("$[?(@.plateNumber=='SEC 001')].phoneNumber").value(hasItem("0712345678")));

        mvc.perform(put("/api/bookings/" + id + "/next").cookie(washer)).andExpect(jsonPath("$.status").value("Washing"));
        mvc.perform(delete("/api/bookings/" + id + "/complete").cookie(washer)).andExpect(status().isNoContent());
    }

    @Test
    void passwordChangeDeletionAndLogoutEndSessions() throws Exception {
        Cookie admin = admin();
        Long id = createWasher(admin, "lerato", "Lerato-Washes-2026");
        Cookie washer = login("lerato", "Lerato-Washes-2026");
        mvc.perform(get("/api/auth/me").cookie(washer)).andExpect(status().isOk());

        mvc.perform(put("/api/users/" + id).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"Lerato-New-2026\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").cookie(washer)).andExpect(status().isUnauthorized());

        Cookie again = login("lerato", "Lerato-New-2026");
        mvc.perform(delete("/api/users/" + id).cookie(admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").cookie(again)).andExpect(status().isUnauthorized());

        Cookie other = admin();
        mvc.perform(post("/api/auth/logout").cookie(other)).andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", containsString("Max-Age=0")));
        mvc.perform(get("/api/auth/me").cookie(other)).andExpect(status().isUnauthorized());
    }

    @Test
    void founderStaysProtected() throws Exception {
        Cookie admin = admin();
        Long founder = users.findByUsername("admin").orElseThrow().getId();
        mvc.perform(put("/api/users/" + founder).cookie(admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"role\":\"WASHER\"}")).andExpect(status().isBadRequest());
        mvc.perform(delete("/api/users/" + founder).cookie(admin)).andExpect(status().isBadRequest());
    }

    @Test
    void oldPlainTextPasswordsAreHashedAtStartup() throws Exception {
        AppUser legacy = new AppUser();
        legacy.setUsername("legacy");
        legacy.setPassword("Legacy-Plain-2026");
        legacy.setRole("WASHER");
        users.save(legacy);

        seeder.run();

        assertTrue(users.findByUsername("legacy").orElseThrow().getPassword().startsWith("scrypt:"));
        login("legacy", "Legacy-Plain-2026");
    }

    @Test
    void repeatedWrongPasswordsAreRateLimited() throws Exception {
        int last = 0;
        for (int i = 0; i < 16; i++) {
            last = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(creds("bruteforce", "guess" + i)))
                    .andReturn().getResponse().getStatus();
        }
        assertEquals(429, last);
    }
}
