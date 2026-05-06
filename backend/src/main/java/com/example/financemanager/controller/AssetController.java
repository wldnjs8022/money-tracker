package com.example.financemanager.controller;

import com.example.financemanager.dto.AssetRequest;
import com.example.financemanager.dto.AssetResponse;
import com.example.financemanager.service.AssetService;
import java.util.List;
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
@RequestMapping("/api/assets")
public class AssetController {
  private final AssetService assetService;

  public AssetController(AssetService assetService) {
    this.assetService = assetService;
  }

  @GetMapping
  public List<AssetResponse> list(@RequestParam String guestId) {
    return assetService.list(guestId);
  }

  @PostMapping
  public AssetResponse create(@RequestBody AssetRequest request) {
    return assetService.create(request);
  }

  @PutMapping("/{id}")
  public AssetResponse update(@PathVariable Long id, @RequestBody AssetRequest request) {
    return assetService.update(id, request);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable Long id, @RequestParam String guestId) {
    assetService.delete(id, guestId);
  }
}
