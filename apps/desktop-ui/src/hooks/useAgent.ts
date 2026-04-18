import { useMutation, useQuery } from "@tanstack/react-query";
import type { AgentQueryInput } from "@starline/shared";
import { agentApi } from "../lib/api.js";

function sessionKey(sessionId: string | null) {
  return ["agent", "session", sessionId] as const;
}

export function useAgentSession(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: () => {
      if (!sessionId) throw new Error("Missing session id");
      return agentApi.getSession(sessionId);
    },
    enabled: enabled && Boolean(sessionId),
  });
}

export function useAgentQuery() {
  return useMutation({
    mutationFn: (input: AgentQueryInput) => agentApi.query(input),
  });
}
