package com.example.financemanager.dto;

import com.example.financemanager.entity.UserAccount;

public record AuthResponse(
  Long id,
  String email,
  String name,
  String ownerId,
  String token
) {
  public static AuthResponse from(UserAccount user, String token) {
    return new AuthResponse(user.getId(), user.getEmail(), user.getName(), user.getOwnerId(), token);
  }
}
