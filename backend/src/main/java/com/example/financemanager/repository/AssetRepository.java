package com.example.financemanager.repository;

import com.example.financemanager.entity.AssetType;
import com.example.financemanager.entity.ManagedAsset;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetRepository extends JpaRepository<ManagedAsset, Long> {
  List<ManagedAsset> findByGuestIdOrderByIdDesc(String guestId);

  List<ManagedAsset> findByGuestId(String guestId);

  long countByGuestId(String guestId);

  List<ManagedAsset> findByGuestIdAndType(String guestId, AssetType type);
}
