package com.example.financemanager.dto;

import com.example.financemanager.entity.ManagedAsset;

public record AssetResponse(
  Long id,
  String name,
  String type,
  Long amount,
  Long profit,
  String memo
) {
  public static AssetResponse from(ManagedAsset asset) {
    return new AssetResponse(
      asset.getId(),
      asset.getName(),
      asset.getType().name(),
      asset.getAmount(),
      asset.getProfit(),
      asset.getMemo()
    );
  }
}
