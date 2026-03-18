/**
 * API client — single source of truth for all backend calls.
 *
 * Uses native fetch with typed wrappers; consumed by TanStack Query hooks.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new ApiError(res.status, error.detail || "Unknown error");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Posts ──────────────────────────────────────────────────────────

export interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  created_at: string;
}

export interface PostCreate {
  title: string;
  content: string;
  category: string;
}

export const postApi = {
  list: () => apiFetch<Post[]>("/api/v1/posts"),
  get: (id: number) => apiFetch<Post>(`/api/v1/posts/${id}`),
  create: (data: PostCreate) =>
    apiFetch<Post>("/api/v1/posts", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<PostCreate>) =>
    apiFetch<Post>(`/api/v1/posts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) =>
    apiFetch<void>(`/api/v1/posts/${id}`, { method: "DELETE" }),
};

// ── Comments ──────────────────────────────────────────────────────

export interface GeneratedComment {
  id: number;
  post_id: number;
  style: string;
  content: string;
  post_analysis_json: string | null;
  prompt_used: string | null;
  round: number;
  parent_comment_id: number | null;
  skip_analysis: boolean;
  skip_few_shot: boolean;
  skip_role: boolean;
  created_at: string;
}

export interface GenerateRequest {
  post_id: number;
  style: string;
  skip_analysis?: boolean;
  skip_few_shot?: boolean;
  skip_role?: boolean;
}

export interface BatchGenerateRequest {
  post_id: number;
  styles?: string[];
  skip_analysis?: boolean;
  skip_few_shot?: boolean;
  skip_role?: boolean;
}

export const commentApi = {
  list: (postId?: number) =>
    apiFetch<GeneratedComment[]>(
      `/api/v1/comments${postId ? `?post_id=${postId}` : ""}`,
    ),
  generate: (data: GenerateRequest) =>
    apiFetch<GeneratedComment>("/api/v1/comments/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  batchGenerate: (data: BatchGenerateRequest) =>
    apiFetch<GeneratedComment[]>("/api/v1/comments/batch-generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  optimize: (commentId: number) =>
    apiFetch<GeneratedComment>(`/api/v1/comments/${commentId}/optimize`, {
      method: "POST",
    }),
};

// ── Evaluations ───────────────────────────────────────────────────

export interface EvaluationRecord {
  id: number;
  comment_id: number;
  agent_name: string;
  context_fit: number;
  style_achievement: number;
  naturalness: number;
  engagement_potential: number;
  overall_score: number;
  attitude: "like" | "neutral" | "dislike";
  reasoning: string;
  created_at: string;
}

export interface DimensionSummary {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface AttitudeDistribution {
  like: number;
  neutral: number;
  dislike: number;
}

export interface EvaluationSummary {
  comment_id: number;
  agent_count: number;
  context_fit: DimensionSummary;
  style_achievement: DimensionSummary;
  naturalness: DimensionSummary;
  engagement_potential: DimensionSummary;
  overall_mean: number;
  attitude_distribution: AttitudeDistribution;
  evaluations: EvaluationRecord[];
}

// ── Settings ──────────────────────────────────────────────────────

export interface LLMConfig {
  api_key_masked: string;
  base_url: string;
  model: string;
  max_concurrency: number;
  presets: { label: string; base_url: string; model: string }[];
}

export interface LLMConfigUpdate {
  api_key?: string;
  base_url?: string;
  model?: string;
  max_concurrency?: number;
}

export interface TestConnectionResult {
  ok: boolean;
  latency_ms: number;
  model: string;
  message: string;
}

export const settingsApi = {
  getLLM: () => apiFetch<LLMConfig>("/api/v1/settings/llm"),
  updateLLM: (data: LLMConfigUpdate) =>
    apiFetch<LLMConfig>("/api/v1/settings/llm", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testConnection: () =>
    apiFetch<TestConnectionResult>("/api/v1/settings/llm/test", {
      method: "POST",
    }),
};

export const evaluationApi = {
  run: (commentId: number) =>
    apiFetch<EvaluationRecord[]>("/api/v1/evaluations/run", {
      method: "POST",
      body: JSON.stringify({ comment_id: commentId }),
    }),
  list: (commentId: number) =>
    apiFetch<EvaluationRecord[]>(`/api/v1/evaluations?comment_id=${commentId}`),
  summary: (commentId: number) =>
    apiFetch<EvaluationSummary>(
      `/api/v1/evaluations/summary?comment_id=${commentId}`,
    ),
};
