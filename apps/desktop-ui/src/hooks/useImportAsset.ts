import { useMutation, useQueryClient } from "@tanstack/react-query";
import { assetsApi } from "../lib/api.js";
import type { ImportAssetFolderInput, ImportAssetInput } from "@starline/shared";

export function useImportAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportAssetInput) => assetsApi.import(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useImportAssetFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportAssetFolderInput) => assetsApi.importFolder(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
