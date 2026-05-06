package com.example.financemanager.dto;

public record AssetRequest(
  String guestId,
  String name,
  String type,
  Long amount,
  Long profit,
  String memo
) {
}
