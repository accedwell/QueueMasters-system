package com.queuemaster.backend.Controllers;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.queuemaster.backend.Repositories.SaleRepository;
import com.queuemaster.backend.Repositories.VehicleRepository;
import com.queuemaster.backend.Security.ApiException;
import com.queuemaster.backend.Security.AuthService;
import com.queuemaster.backend.Services.SaleRecord;
import com.queuemaster.backend.Services.Vehicle;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Customers (no login) may book a wash and watch the public queue. Everything else -
 * moving cars along, editing, releasing, and all money figures - needs a staff session.
 */
@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final VehicleRepository repository;
    private final SaleRepository saleRepository;
    private final AuthService auth;

    public BookingController(VehicleRepository repository, SaleRepository saleRepository, AuthService auth) {
        this.repository = repository;
        this.saleRepository = saleRepository;
        this.auth = auth;
    }

    /** What the API returns for a car. The phone number is only included for signed-in staff. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record VehicleView(Long id, String plateNumber, String carModel, String washType, String status,
                              boolean paid, double amountPaid, String phoneNumber, LocalDateTime createdAt) {
        static VehicleView of(Vehicle v, boolean staff) {
            return new VehicleView(v.getId(), v.getPlateNumber(), v.getCarModel(), v.getWashType(), v.getStatus(),
                    v.isPaid(), v.getAmountPaid(), staff ? v.getPhoneNumber() : null, v.getCreatedAt());
        }
    }

    /** Single source of truth for pricing. */
    static double priceFor(String washType) {
        String t = washType == null ? "" : washType.toLowerCase();
        if (t.contains("valet")) return 350.0;
        if (t.contains("engine")) return 150.0;
        return 100.0;
    }

    private static void checkLengths(Vehicle v) {
        for (String s : new String[]{v.getPlateNumber(), v.getCarModel(), v.getPhoneNumber(), v.getWashType()}) {
            if (s != null && s.length() > 255) throw new ApiException(400, "Fields must be 255 characters or fewer.");
        }
    }

    @GetMapping
    public List<VehicleView> getBookings(HttpServletRequest request) {
        boolean staff = auth.currentUser(request).isPresent();
        return repository.findAll(Sort.by("id")).stream().map(v -> VehicleView.of(v, staff)).toList();
    }

    /** Public: a customer books a wash. Price and status are set here, never taken from the request. */
    @PostMapping
    public ResponseEntity<?> addBooking(@RequestBody Vehicle vehicle) {
        if (vehicle.getPlateNumber() == null || vehicle.getPlateNumber().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Number plate is required.");
        }
        checkLengths(vehicle);
        vehicle.setId(null);
        vehicle.setPlateNumber(vehicle.getPlateNumber().trim().toUpperCase());
        if (vehicle.getWashType() == null || vehicle.getWashType().trim().isEmpty()) {
            vehicle.setWashType("Standard Wash");
        }
        vehicle.setStatus("In Queue");
        vehicle.setPaid(true);
        vehicle.setAmountPaid(priceFor(vehicle.getWashType()));
        vehicle.setCreatedAt(null); // stamped by @PrePersist
        // The customer just typed their own number, so it is fine to echo it back on their ticket.
        return ResponseEntity.ok(VehicleView.of(repository.save(vehicle), true));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateVehicle(@PathVariable Long id, @RequestBody Vehicle updated, HttpServletRequest request) {
        auth.requireStaff(request);
        checkLengths(updated);
        Optional<Vehicle> found = repository.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Vehicle vehicle = found.get();
        if (updated.getPlateNumber() != null) vehicle.setPlateNumber(updated.getPlateNumber().trim().toUpperCase());
        if (updated.getCarModel() != null) vehicle.setCarModel(updated.getCarModel());
        if (updated.getPhoneNumber() != null) vehicle.setPhoneNumber(updated.getPhoneNumber());
        return ResponseEntity.ok(VehicleView.of(repository.save(vehicle), true));
    }

    @PutMapping("/{id}/next")
    public ResponseEntity<?> moveToNextStatus(@PathVariable Long id, HttpServletRequest request) {
        auth.requireStaff(request);
        Optional<Vehicle> found = repository.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Vehicle vehicle = found.get();
        String current = vehicle.getStatus() == null ? "In Queue" : vehicle.getStatus();
        if (current.equals("In Queue")) vehicle.setStatus("Washing");
        else if (current.equals("Washing")) vehicle.setStatus("Ready");
        else vehicle.setStatus(current);
        return ResponseEntity.ok(VehicleView.of(repository.save(vehicle), true));
    }

    /** Release a car: archive the sale and remove it from the queue in one transaction. */
    @Transactional
    @DeleteMapping("/{id}/complete")
    public ResponseEntity<?> completeWash(@PathVariable Long id, HttpServletRequest request) {
        auth.requireStaff(request);
        Optional<Vehicle> found = repository.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Vehicle vehicle = found.get();
        SaleRecord sale = new SaleRecord();
        sale.setPlateNumber(vehicle.getPlateNumber());
        sale.setWashType(vehicle.getWashType());
        sale.setDate(LocalDate.now());
        sale.setAmount(vehicle.getAmountPaid() > 0 ? vehicle.getAmountPaid() : priceFor(vehicle.getWashType()));
        saleRepository.save(sale);
        repository.delete(vehicle);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/daily-total")
    public double getDailyTotal(HttpServletRequest request) {
        auth.requireStaff(request);
        return saleRepository.findByDate(LocalDate.now())
                .stream()
                .mapToDouble(SaleRecord::getAmount)
                .sum();
    }

    @GetMapping("/all-sales")
    public List<SaleRecord> getAllSales(HttpServletRequest request) {
        auth.requireStaff(request);
        return saleRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    @DeleteMapping("/clear-archive")
    public ResponseEntity<Void> clearEntireArchive(HttpServletRequest request) {
        auth.requireAdmin(request);
        saleRepository.deleteAll();
        return ResponseEntity.noContent().build();
    }
}
