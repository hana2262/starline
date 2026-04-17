import { useQuery } from "@tanstack/react-query";
import { assetsApi } from "../lib/api.js";
import type { AssetType } from "@starline/shared";

interface UseAssetsInput {
  query?: string;
  projectId?: string;
  type?: AssetType;
  limit: number;
  offset: number;
}

export function useAssets(input: UseAssetsInput) {
  return useQuery({
    queryKey: ["assets", input],
    queryFn: () =>
      assetsApi.list({
        query: input.query || undefined,
        projectId: input.projectId || undefined,
        type: input.type,
        limit: input.limit,
        offset: input.offset,
      }),
  });
}

