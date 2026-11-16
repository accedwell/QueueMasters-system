package com.queuemaster.backend.Controllers;

import com.queuemaster.backend.Repositories.SaleRepository;
import com.queuemaster.backend.Repositories.VehicleRepository;
import com.queuemaster.backend.Services.SaleRecord;
import com.queuemaster.backend.Services.Vehicle;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    @Autowired
    private VehicleRepository repository;

    @Autowired
    private SaleRepository saleRepository;

    /** Single source of truth for pricing. */
    static double priceFor(String washType) {
        String t = washType == null ? "" : washType.toLowerCase();
        if (t.contains("valet")) return 350.0;
        if (t.contains("engine")) return 150.0;
        return 100.0;
    }

    @GetMapping
    public List<Vehicle> getBookings() {
        return repository.findAll(Sort.by("id"));
    }

    @PostMapping
    public ResponseEntity<?> addBooking(@RequestBody Vehicle vehicle) {
        if (vehicle.getPlateNumber() == null || vehicle.getPlateNumber().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Number plate is required.");
        }
        vehicle.setId(null);
        vehicle.setPlateNumber(vehicle.getPlateNumber().trim().toUpperCase());
        if (vehicle.getWashType() == null || vehicle.getWashType().trim().isEmpty()) {
            vehicle.setWashType("Standard Wash");
        }
        vehicle.setStatus("In Queue");
        vehicle.setPaid(true);
        vehicle.setAmountPaid(priceFor(vehicle.getWashType()));
        vehicle.setCreatedAt(null); // stamped by @PrePersist
        return ResponseEntity.ok(repository.save(vehicle));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateVehicle(@PathVariable Long id, @RequestBody Vehicle updated) {
        Optional<Vehicle> found = repository.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Vehicle vehicle = found.get();
        if (updated.getPlateNumber() != null) vehicle.setPlateNumber(updated.getPlateNumber().trim().toUpperCase());
        if (updated.getCarModel() != null) vehicle.setCarModel(updated.getCarModel());
        if (updated.getPhoneNumber() != null) vehicle.setPhoneNumber(updated.getPhoneNumber());
        return ResponseEntity.ok(repository.save(vehicle));
    }

    @PutMapping("/{id}/next")
    public ResponseEntity<?> moveToNextStatus(@PathVariable Long id) {
        Optional<Vehicle> found = repository.findById(id);
        if (found.isEmpty()) return ResponseEntity.notFound().build();
        Vehicle vehicle = found.get();
        String current = vehicle.getStatus() == null ? "In Queue" : vehicle.getStatus();
        if (current.equals("In Queue")) vehicle.setStatus("Washing");
        else if (current.equals("Washing")) vehicle.setStatus("Ready");
        else vehicle.setStatus(current);
        return ResponseEntity.ok(repository.save(vehicle));
    }

    @DeleteMapping("/{id}/complete")
    public ResponseEntity<?> completeWash(@PathVariable Long id) {
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
    public double getDailyTotal() {
        return saleRepository.findByDate(LocalDate.now())
                .stream()
                .mapToDouble(SaleRecord::getAmount)
                .sum();
    }

    @GetMapping("/all-sales")
    public List<SaleRecord> getAllSales() {
        return saleRepository.findAll(Sort.by(Sort.Direction.DESC, "id"));
    }

    @DeleteMapping("/clear-archive")
    public void clearEntireArchive() {
        saleRepository.deleteAll();
    }
}
