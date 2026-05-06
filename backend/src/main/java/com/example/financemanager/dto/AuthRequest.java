package com.example.financemanager.dto;

public record AuthRequest(
  String email,
  String password,
  String name,
  String guestId
) {
}
