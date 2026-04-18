import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConnectorConfigUpsertInput } from "@starline/shared";
import { connectorsApi } from "../lib/api.js";

const QUERY_KEY = ["connectors"] as const;

export function useConnectors(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: connectorsApi.list,
    enabled,
  });
}

export function useSaveConnector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ConnectorConfigUpsertInput) => connectorsApi.save(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useTestConnector() {
  return useMutation({
    mutationFn: (connectorId: string) => connectorsApi.test(connectorId),
  });
}
