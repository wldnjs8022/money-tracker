package com.example.financemanager.service;

import com.example.financemanager.dto.AssetRequest;
import com.example.financemanager.dto.AssetResponse;
import com.example.financemanager.entity.AssetType;
import com.example.financemanager.entity.ManagedAsset;
import com.example.financemanager.repository.AssetRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AssetService {
  private final AssetRepository assetRepository;

  public AssetService(AssetRepository assetRepository) {
    this.assetRepository = assetRepository;
  }

  public List<AssetResponse> list(String guestId) {
    deleteDuplicates(guestId);
    return assetRepository.findByGuestIdOrderByIdDesc(guestId).stream().map(AssetResponse::from).toList();
  }

  public AssetResponse create(AssetRequest request) {
    ManagedAsset asset = new ManagedAsset();
    apply(asset, request);
    return AssetResponse.from(assetRepository.save(asset));
  }

  public AssetResponse update(Long id, AssetRequest request) {
    ManagedAsset asset = findOwned(id, request.guestId());
    apply(asset, request);
    return AssetResponse.from(asset);
  }

  public void delete(Long id, String guestId) {
    assetRepository.delete(findOwned(id, guestId));
  }

  public void migrateOwner(String fromGuestId, String toOwnerId) {
    if (fromGuestId == null || fromGuestId.isBlank() || toOwnerId == null || toOwnerId.isBlank() || fromGuestId.equals(toOwnerId)) {
      return;
    }
    Set<String> targetKeys = new HashSet<>();
    for (ManagedAsset target : assetRepository.findByGuestId(toOwnerId)) {
      targetKeys.add(signature(target));
    }

    for (ManagedAsset source : assetRepository.findByGuestId(fromGuestId)) {
      if (targetKeys.contains(signature(source))) {
        assetRepository.delete(source);
      } else {
        source.setGuestId(toOwnerId);
        targetKeys.add(signature(source));
      }
    }
  }

  private ManagedAsset findOwned(Long id, String guestId) {
    ManagedAsset asset = assetRepository.findById(id)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "자산을 찾을 수 없습니다."));
    if (!asset.getGuestId().equals(guestId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "다른 사용자의 자산은 수정할 수 없습니다.");
    }
    return asset;
  }

  private void apply(ManagedAsset asset, AssetRequest request) {
    if (request.guestId() == null || request.guestId().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "guestId가 필요합니다.");
    }
    if (request.amount() == null || request.amount() < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자산 금액은 0 이상이어야 합니다.");
    }

    asset.setGuestId(request.guestId());
    asset.setName(blankToDefault(request.name(), "이름 없는 자산"));
    asset.setType(parseType(request.type()));
    asset.setAmount(request.amount());
    asset.setProfit(request.profit() == null ? 0L : request.profit());
    asset.setMemo(request.memo() == null ? "" : request.memo());
  }

  private AssetType parseType(String value) {
    if (value == null || value.isBlank()) return AssetType.ETC;
    try {
      return AssetType.valueOf(value.toUpperCase());
    } catch (IllegalArgumentException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "자산 유형은 CASH, BANK, STOCK, ETC만 가능합니다.");
    }
  }

  private String blankToDefault(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  private void deleteDuplicates(String guestId) {
    if (guestId == null || guestId.isBlank()) {
      return;
    }

    Set<String> seen = new HashSet<>();
    for (ManagedAsset asset : assetRepository.findByGuestIdOrderByIdDesc(guestId)) {
      String key = signature(asset);
      if (seen.contains(key)) {
        assetRepository.delete(asset);
      } else {
        seen.add(key);
      }
    }
  }

  private String signature(ManagedAsset asset) {
    return String.join("|",
      asset.getName(),
      String.valueOf(asset.getType()),
      String.valueOf(asset.getAmount()),
      String.valueOf(asset.getProfit()),
      asset.getMemo() == null ? "" : asset.getMemo()
    );
  }
}
