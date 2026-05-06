package com.example.financemanager.dto;

public record SummaryResponse(
  Long income,
  Long expense,
  Long balance
) {
}
