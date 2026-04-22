import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentProviderUpsertInput } from "@starline/shared";
import { agentApi } from "../lib/api.js";

const PROVIDERS_QUERY_KEY = ["agent", "providers"] as const;
const RUNTIME_QUERY_KEY = ["agent", "runtime"] as const;

export function useAgentProviders(enabled = true) {
  return useQuery({
    queryKey: PROVIDERS_QUERY_KEY,
    queryFn: () => agentApi.listProviders(),
    enabled,
  });
}

export function useSaveAgentProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AgentProviderUpsertInput) => agentApi.saveProvider(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROVIDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RUNTIME_QUERY_KEY }),
      ]);
    },
  });
}

export function useActivateAgentProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentApi.activateProvider(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROVIDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RUNTIME_QUERY_KEY }),
      ]);
    },
  });
}

export function useTestAgentProvider() {
  return useMutation({
    mutationFn: (id: string) => agentApi.testProvider(id),
  });
}

export function useRemoveAgentProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentApi.removeProvider(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: PROVIDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: RUNTIME_QUERY_KEY }),
      ]);
    },
  });
}
