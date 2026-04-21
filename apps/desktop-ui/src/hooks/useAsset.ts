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
      qc.setQueryData(["asset", asset.id], asset);
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useTrashAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsApi.moveToTrash(id),
    onSuccess: (asset) => {
      qc.setQueryData(["asset", asset.id], asset);
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useRestoreAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsApi.restoreFromTrash(id),
    onSuccess: (asset) => {
      qc.setQueryData(["asset", asset.id], asset);
      qc.invalidateQueries({ queryKey: ["asset", asset.id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useRemoveAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsApi.removeFromLibrary(id),
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: ["asset", id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function usePermanentlyDeleteAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => assetsApi.permanentlyDelete(id),
    onSuccess: (_result, id) => {
      qc.removeQueries({ queryKey: ["asset", id] });
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
