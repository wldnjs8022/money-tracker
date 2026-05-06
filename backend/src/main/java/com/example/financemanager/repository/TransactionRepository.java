package com.example.financemanager.repository;

import com.example.financemanager.entity.FinanceTransaction;
import com.example.financemanager.entity.TransactionType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<FinanceTransaction, Long> {
  List<FinanceTransaction> findByGuestIdOrderByDateDescIdDesc(String guestId);

  List<FinanceTransaction> findByGuestId(String guestId);

  long countByGuestId(String guestId);

  List<FinanceTransaction> findByGuestIdAndType(String guestId, TransactionType type);
}
