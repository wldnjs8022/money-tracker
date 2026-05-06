package com.example.financemanager.dto;

import com.example.financemanager.entity.FinanceTransaction;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

public record TransactionResponse(
  Long id,
  LocalDate date,
  String type,
  String category,
  List<String> tags,
  Long amount,
  String method,
  String memo
) {
  public static TransactionResponse from(FinanceTransaction transaction) {
    List<String> tags = transaction.getTags() == null || transaction.getTags().isBlank()
      ? List.of()
      : Arrays.stream(transaction.getTags().split(",")).map(String::trim).filter(tag -> !tag.isBlank()).toList();

    return new TransactionResponse(
      transaction.getId(),
      transaction.getDate(),
      transaction.getType().name().toLowerCase(),
      transaction.getCategory(),
      tags,
      transaction.getAmount(),
      transaction.getMethod(),
      transaction.getMemo()
    );
  }
}
