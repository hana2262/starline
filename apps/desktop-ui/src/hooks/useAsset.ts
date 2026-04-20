import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateAssetInput } from "@starline/shared";
import { assetsApi } from "../lib/api.js";

export function useAsset(assetId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => assetsApi.getById(assetId!),
    enabled: enabled && Boolean(assetId),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssetInput }) =>
      assetsApi.update(id, input),
    onSuccess: (asset) => {
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
