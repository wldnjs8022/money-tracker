import { apiRequest } from "./client";
import type { UserSession } from "../types/finance";

export type AuthPayload = {
  email: string;
  password: string;
  name?: string;
  guestId: string;
};

export function register(payload: AuthPayload) {
  return apiRequest<UserSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload: AuthPayload) {
  return apiRequest<UserSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
