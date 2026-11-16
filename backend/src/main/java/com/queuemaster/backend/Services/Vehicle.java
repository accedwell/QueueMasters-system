package com.queuemaster.backend.Services;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
public class Vehicle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String plateNumber;
    private String carModel;
    private String washType;
    private String status;
    private boolean isPaid;
    private double amountPaid;
    private String phoneNumber;

    /** When the car was checked in - used for wait-time display. */
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
