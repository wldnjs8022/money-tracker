package com.example.financemanager.service;

import com.example.financemanager.dto.SummaryResponse;
import com.example.financemanager.dto.TransactionRequest;
import com.example.financemanager.dto.TransactionResponse;
import com.example.financemanager.entity.FinanceTransaction;
import com.example.financemanager.entity.TransactionType;
import com.example.financemanager.repository.TransactionRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class TransactionService {
  private final TransactionRepository transactionRepository;

  public TransactionService(TransactionRepository transactionRepository) {
    this.transactionRepository = transactionRepository;
  }

  public List<TransactionResponse> list(String guestId) {
    deleteDuplicates(guestId);
    return transactionRepository.findByGuestIdOrderByDateDescIdDesc(guestId)
      .stream()
      .map(TransactionResponse::from)
      .toList();
  }

  public SummaryResponse summary(String guestId) {
    deleteDuplicates(guestId);
    long income = sumByType(guestId, TransactionType.INCOME);
    long expense = sumByType(guestId, TransactionType.EXPENSE);
    return new SummaryResponse(income, expense, income - expense);
  }

  @Transactional
  public TransactionResponse create(TransactionRequest request) {
    FinanceTransaction transaction = new FinanceTransaction();
    applyRequest(transaction, request);
    return TransactionResponse.from(transactionRepository.save(transaction));
  }

  @Transactional
  public TransactionResponse update(Long id, TransactionRequest request) {
    FinanceTransaction transaction = findOwned(id, request.guestId());
    applyRequest(transaction, request);
    return TransactionResponse.from(transaction);
  }

  @Transactional
  public void delete(Long id, String guestId) {
    FinanceTransaction transaction = findOwned(id, guestId);
    transactionRepository.delete(transaction);
  }

  public void migrateOwner(String fromGuestId, String toOwnerId) {
    if (fromGuestId == null || fromGuestId.isBlank() || toOwnerId == null || toOwnerId.isBlank() || fromGuestId.equals(toOwnerId)) {
      return;
    }

    Set<String> targetKeys = new HashSet<>();
    for (FinanceTransaction target : transactionRepository.findByGuestId(toOwnerId)) {
      targetKeys.add(signature(target));
    }

    for (FinanceTransaction source : transactionRepository.findByGuestId(fromGuestId)) {
      if (targetKeys.contains(signature(source))) {
        transactionRepository.delete(source);
      } else {
        source.setGuestId(toOwnerId);
        targetKeys.add(signature(source));
      }
    }
  }

  private FinanceTransaction findOwned(Long id, String guestId) {
    FinanceTransaction transaction = transactionRepository.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "거래 내역을 찾을 수 없습니다."));

    if (!transaction.getGuestId().equals(guestId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "다른 게스트의 데이터는 수정할 수 없습니다.");
    }
    return transaction;
  }

  private long sumByType(String guestId, TransactionType type) {
    return transactionRepository.findByGuestIdAndType(guestId, type)
      .stream()
      .mapToLong(FinanceTransaction::getAmount)
      .sum();
  }

  private void applyRequest(FinanceTransaction transaction, TransactionRequest request) {
    if (request.guestId() == null || request.guestId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "guestId가 필요합니다.");
    }
    if (request.amount() == null || request.amount() <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "금액은 0보다 커야 합니다.");
    }

    transaction.setGuestId(request.guestId());
    transaction.setDate(request.date() == null ? java.time.LocalDate.now() : request.date());
    transaction.setType(parseType(request.type()));
    transaction.setCategory(blankToDefault(request.category(), "기타"));
    transaction.setAmount(request.amount());
    transaction.setMethod(blankToDefault(request.method(), "미지정"));
    transaction.setMemo(request.memo() == null ? "" : request.memo());
    transaction.setTags(request.tags() == null ? "" : String.join(",", request.tags()));
  }

  private TransactionType parseType(String value) {
    if (value == null) return TransactionType.EXPENSE;
    return switch (value.toUpperCase()) {
      case "INCOME" -> TransactionType.INCOME;
      case "EXPENSE" -> TransactionType.EXPENSE;
      default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type은 income 또는 expense만 가능합니다.");
    };
  }

  private String blankToDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private void deleteDuplicates(String guestId) {
    if (guestId == null || guestId.isBlank()) {
      return;
    }

    Set<String> seen = new HashSet<>();
    for (FinanceTransaction transaction : transactionRepository.findByGuestIdOrderByDateDescIdDesc(guestId)) {
      String key = signature(transaction);
      if (seen.contains(key)) {
        transactionRepository.delete(transaction);
      } else {
        seen.add(key);
      }
    }
  }

  private String signature(FinanceTransaction transaction) {
    return String.join("|",
      String.valueOf(transaction.getDate()),
      String.valueOf(transaction.getType()),
      transaction.getCategory(),
      String.valueOf(transaction.getAmount()),
      transaction.getMethod(),
      transaction.getMemo() == null ? "" : transaction.getMemo(),
      transaction.getTags() == null ? "" : transaction.getTags()
    );
  }
}
