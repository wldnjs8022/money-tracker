package com.example.financemanager.dto;

import java.time.LocalDate;
import java.util.List;

public record TransactionRequest(
  String guestId,
  LocalDate date,
  String type,
  String category,
  Long amount,
  String method,
  String memo,
  List<String> tags
) {
}
