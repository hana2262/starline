export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface GenerateInput {
  prompt:     string;
  type:       "image" | "video" | "audio" | "prompt" | "other";
  projectId?: string;
  settings?:  Record<string, unknown>;
}

export interface GenerateOutput {
  /** Temp file written by the connector. Caller is responsible for cleanup. */
  filePath: string;
  mimeType: string;
  name:     string;
  meta: {
    model:     string;
    seed:      string;
    latencyMs: number;
  };
}

export interface Connector {
  readonly id:   string;
  readonly name: string;
  healthCheck(): Promise<HealthCheckResult>;
  generate(input: GenerateInput): Promise<GenerateOutput>;
}
