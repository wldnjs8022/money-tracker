package com.example.financemanager.controller;

import com.example.financemanager.dto.SummaryResponse;
import com.example.financemanager.dto.TransactionRequest;
import com.example.financemanager.dto.TransactionResponse;
import com.example.financemanager.service.TransactionService;
import java.util.List;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {
  private final TransactionService transactionService;

  public TransactionController(TransactionService transactionService) {
    this.transactionService = transactionService;
  }

  @GetMapping
  public List<TransactionResponse> list(@RequestParam String guestId) {
    return transactionService.list(guestId);
  }

  @GetMapping("/summary")
  public SummaryResponse summary(@RequestParam String guestId) {
    return transactionService.summary(guestId);
  }

  @PostMapping
  public TransactionResponse create(@RequestBody TransactionRequest request) {
    return transactionService.create(request);
  }

  @PutMapping("/{id}")
  public TransactionResponse update(@PathVariable Long id, @RequestBody TransactionRequest request) {
    return transactionService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id, @RequestParam String guestId) {
    transactionService.delete(id, guestId);
  }
}
