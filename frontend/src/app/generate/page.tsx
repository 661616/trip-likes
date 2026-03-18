/**
 * CommentGeneration - 评论生成页面（两栏布局）
 *
 * 功能：针对单个帖子，选择风格 → 批量生成评论 → 对每条评论发起评估/优化
 * 数据流：URL ?postId= → 左栏展示帖子摘要 → 右栏展示生成结果
 * 交互：
 *   左栏固定不滚动，始终可见生成按钮
 *   右栏独立滚动，展示历史生成记录
 *   风格标签多选，支持全选/全清
 */

"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  postApi,
  commentApi,
  evaluationApi,
  type GeneratedComment,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

const STYLES = [
  { value: "humorous", label: "幽默", color: "bg-yellow-500/10 text-yellow-400 ring-yellow-400/50" },
  { value: "analytical", label: "理性", color: "bg-blue-500/10 text-blue-400 ring-blue-400/50" },
  { value: "empathetic", label: "共鸣", color: "bg-pink-500/10 text-pink-400 ring-pink-400/50" },
  { value: "controversial", label: "争议", color: "bg-orange-500/10 text-orange-400 ring-orange-400/50" },
  { value: "supportive", label: "支持", color: "bg-green-500/10 text-green-400 ring-green-400/50" },
];

const STYLE_MAP: Record<string, (typeof STYLES)[number]> = Object.fromEntries(
  STYLES.map((s) => [s.value, s]),
);

const ALL_STYLE_VALUES = STYLES.map((s) => s.value);

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const postId = Number(searchParams.get("postId")) || 0;

  // UI state: which styles are selected for batch generation
  const [selectedStyles, setSelectedStyles] = useState<string[]>(ALL_STYLE_VALUES);
  // UI state: which comment card is expanded to show debug info
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // UI state: error from LLM mutations
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Server state: the post being commented on
  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => postApi.get(postId),
    enabled: postId > 0,
  });

  // Server state: generated comments for this post
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => commentApi.list(postId),
    enabled: postId > 0,
  });

  function handleError(err: unknown) {
    setErrorMsg(err instanceof Error ? err.message : "请求失败，请重试");
  }

  const batchMutation = useMutation({
    mutationFn: () =>
      commentApi.batchGenerate({ post_id: postId, styles: selectedStyles }),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: handleError,
  });

  const evaluateMutation = useMutation({
    mutationFn: (commentId: number) => evaluationApi.run(commentId),
    onSuccess: (_data, commentId) => {
      setErrorMsg(null);
      router.push(`/evaluation?commentId=${commentId}`);
    },
    onError: handleError,
  });

  const optimizeMutation = useMutation({
    mutationFn: (commentId: number) => commentApi.optimize(commentId),
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: handleError,
  });

  function handleToggleStyle(value: string) {
    setSelectedStyles((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    );
  }

  function handleToggleAll() {
    setSelectedStyles((prev) =>
      prev.length === ALL_STYLE_VALUES.length ? [] : ALL_STYLE_VALUES,
    );
  }

  // ── No postId: prompt user to go back ─────────────────────────────
  if (!postId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">请先从帖子管理页选择一个帖子</p>
        <button
          onClick={() => router.push("/posts")}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          前往帖子管理
        </button>
      </div>
    );
  }

  const allSelected = selectedStyles.length === ALL_STYLE_VALUES.length;

  return (
    // Two-column layout: left panel sticky, right panel scrolls independently
    <div className="flex h-full divide-x divide-border">

      {/* ── Left Panel (sticky, 320px) ─────────────────────────────── */}
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto">
        {/* Back breadcrumb */}
        <div className="border-b border-border px-5 py-3">
          <button
            onClick={() => router.push("/posts")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            帖子管理
          </button>
        </div>

        {/* Post summary card */}
        <div className="border-b border-border px-5 py-4">
          {postLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
              <div className="h-3 w-full animate-pulse rounded bg-secondary" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-secondary" />
            </div>
          ) : post ? (
            <>
              <h2 className="text-sm font-semibold leading-snug">{post.title}</h2>
              <p className="mt-1.5 line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                {post.content}
              </p>
              <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {post.category}
              </span>
            </>
          ) : null}
        </div>

        {/* Style selector */}
        <div className="flex-1 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              评论风格
            </span>
            <button
              onClick={handleToggleAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {allSelected ? "全清" : "全选"}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {STYLES.map((s) => {
              const active = selectedStyles.includes(s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => handleToggleStyle(s.value)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                    active
                      ? "border-transparent " + s.color + " ring-1"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
                  )}
                >
                  <span className="font-medium">{s.label}</span>
                  {active && <CheckSquare className="h-3.5 w-3.5 opacity-60" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate button + error — pinned to bottom of left panel */}
        <div className="border-t border-border px-5 py-4">
          {/* Error banner */}
          {errorMsg && (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                {errorMsg}
                {errorMsg.includes("设置") && (
                  <a href="/settings" className="ml-1 underline">
                    前往设置
                  </a>
                )}
              </span>
              <button onClick={() => setErrorMsg(null)}>
                <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          )}

          <button
            onClick={() => batchMutation.mutate()}
            disabled={batchMutation.isPending || selectedStyles.length === 0}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors",
              batchMutation.isPending || selectedStyles.length === 0
                ? "bg-primary/50 text-primary-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {batchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {batchMutation.isPending
              ? `生成中 (${selectedStyles.length} 种风格)…`
              : selectedStyles.length === 0
                ? "请至少选择一种风格"
                : `批量生成 ${selectedStyles.length} 种风格`}
          </button>
        </div>
      </aside>

      {/* ── Right Panel (scrollable results) ───────────────────────── */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              生成结果
              {comments.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal">
                  共 {comments.length} 条
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 px-6 py-4">
          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-secondary/50" />
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                在左侧选择风格，点击「批量生成」开始
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  expanded={expandedId === comment.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) =>
                      prev === comment.id ? null : comment.id,
                    )
                  }
                  onEvaluate={() => evaluateMutation.mutate(comment.id)}
                  onOptimize={() => optimizeMutation.mutate(comment.id)}
                  isEvaluating={
                    evaluateMutation.isPending &&
                    evaluateMutation.variables === comment.id
                  }
                  isOptimizing={
                    optimizeMutation.isPending &&
                    optimizeMutation.variables === comment.id
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-muted-foreground">
          加载中...
        </div>
      }
    >
      <GeneratePageContent />
    </Suspense>
  );
}

// ── Comment Card ────────────────────────────────────────────────────

interface CommentCardProps {
  comment: GeneratedComment;
  expanded: boolean;
  onToggleExpand: () => void;
  onEvaluate: () => void;
  onOptimize: () => void;
  isEvaluating: boolean;
  isOptimizing: boolean;
}

function CommentCard({
  comment,
  expanded,
  onToggleExpand,
  onEvaluate,
  onOptimize,
  isEvaluating,
  isOptimizing,
}: CommentCardProps) {
  const styleInfo = STYLE_MAP[comment.style];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-sm">
      {/* Card header: style tag + actions */}
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-2.5">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            styleInfo?.color?.split(" ring-")[0] ?? "bg-secondary text-muted-foreground",
          )}
        >
          {styleInfo?.label ?? comment.style}
        </span>
        {comment.round > 1 && (
          <span className="text-xs text-muted-foreground">第 {comment.round} 轮</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onEvaluate}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
          >
            {isEvaluating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <BarChart3 className="h-3 w-3" />
            )}
            评估
          </button>
          <button
            onClick={onOptimize}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
          >
            {isOptimizing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            优化
          </button>
          <button
            onClick={onToggleExpand}
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors"
            title={expanded ? "收起" : "展开调试信息"}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Comment text */}
      <div className="px-4 py-3">
        <p className="text-sm leading-relaxed">{comment.content}</p>
      </div>

      {/* Debug panel */}
      {expanded && (
        <div className="border-t border-border bg-secondary/20 space-y-3 px-4 py-3 text-xs">
          {comment.post_analysis_json && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">帖子分析 JSON</p>
              <pre className="overflow-auto rounded bg-secondary/50 p-2 text-muted-foreground max-h-48">
                {JSON.stringify(JSON.parse(comment.post_analysis_json), null, 2)}
              </pre>
            </div>
          )}
          {comment.prompt_used && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">使用的 Prompt</p>
              <pre className="overflow-auto rounded bg-secondary/50 p-2 text-muted-foreground whitespace-pre-wrap max-h-48">
                {comment.prompt_used}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
