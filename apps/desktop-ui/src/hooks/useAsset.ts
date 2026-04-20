import { useQuery } from "@tanstack/react-query";
import { assetsApi } from "../lib/api.js";

export function useAsset(assetId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.getById(assetId!),
    enabled: enabled && Boolean(assetId),
  });
}
