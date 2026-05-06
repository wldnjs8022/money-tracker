import { apiRequest } from "./client";
import type { Asset, AssetType } from "../types/finance";

export type AssetPayload = {
  guestId: string;
  name: string;
  type: AssetType;
  amount: number;
  profit: number;
  memo: string;
};

export function getAssets(guestId: string) {
  return apiRequest<Asset[]>(`/assets?guestId=${encodeURIComponent(guestId)}`);
}

export function createAsset(payload: AssetPayload) {
  return apiRequest<Asset>("/assets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAsset(id: number, payload: AssetPayload) {
  return apiRequest<Asset>(`/assets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteAsset(id: number, guestId: string) {
  return apiRequest<void>(`/assets/${id}?guestId=${encodeURIComponent(guestId)}`, {
    method: "DELETE"
  });
}
