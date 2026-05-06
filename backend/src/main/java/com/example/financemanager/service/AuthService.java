package com.example.financemanager.service;

import com.example.financemanager.dto.AuthRequest;
import com.example.financemanager.dto.AuthResponse;
import com.example.financemanager.entity.UserAccount;
import com.example.financemanager.repository.UserAccountRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AuthService {
  private final UserAccountRepository userAccountRepository;
  private final TransactionService transactionService;
  private final AssetService assetService;

  public AuthService(UserAccountRepository userAccountRepository, TransactionService transactionService, AssetService assetService) {
    this.userAccountRepository = userAccountRepository;
    this.transactionService = transactionService;
    this.assetService = assetService;
  }

  public AuthResponse register(AuthRequest request) {
    String email = normalizeEmail(request.email());
    if (userAccountRepository.existsByEmail(email)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 가입된 이메일입니다.");
    }
    if (request.password() == null || request.password().length() < 4) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 4자 이상이어야 합니다.");
    }

    UserAccount user = new UserAccount();
    user.setEmail(email);
    user.setName(request.name() == null || request.name().isBlank() ? "사용자" : request.name());
    user.setPasswordHash(hash(request.password()));
    user.setOwnerId("user-" + UUID.randomUUID());
    userAccountRepository.save(user);
    migrateGuestData(request.guestId(), user.getOwnerId());
    return AuthResponse.from(user, issueToken());
  }

  public AuthResponse login(AuthRequest request) {
    String email = normalizeEmail(request.email());
    UserAccount user = userAccountRepository.findByEmail(email)
      .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다."));
    if (!user.getPasswordHash().equals(hash(request.password()))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    return AuthResponse.from(user, issueToken());
  }

  private void migrateGuestData(String fromGuestId, String toOwnerId) {
    if (fromGuestId == null || fromGuestId.isBlank() || fromGuestId.equals(toOwnerId)) {
      return;
    }
    transactionService.migrateOwner(fromGuestId, toOwnerId);
    assetService.migrateOwner(fromGuestId, toOwnerId);
  }

  private String normalizeEmail(String email) {
    if (email == null || email.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일이 필요합니다.");
    }
    return email.trim().toLowerCase();
  }

  private String issueToken() {
    return "local-" + UUID.randomUUID();
  }

  private String hash(String raw) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest((raw == null ? "" : raw).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(bytes);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is not available", exception);
    }
  }
}
