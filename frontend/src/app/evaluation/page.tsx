/**
 * EvaluationResult - 评估结果页面
 *
 * 功能：展示某条评论的多Agent评估结果：雷达图/柱状图/饼图 + Agent评语
 * 数据流：URL ?commentId= → GET /api/v1/evaluations/summary → 渲染可视化
 * 交互：查看各Agent详细评语；支持跳回生成页执行优化
 */

"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { evaluationApi } from "@/lib/api";
import type { EvaluationSummary, EvaluationRecord, AttitudeDistribution } from "@/lib/api";

// Lazy-load chart components — recharts is heavy and only needed on this page
const DimensionRadarChart = dynamic(
  () => import("@/components/radar-chart").then((m) => m.DimensionRadarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const AgentScoreBarChart = dynamic(
  () => import("@/components/score-bar-chart").then((m) => m.AgentScoreBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const AttitudePieChart = dynamic(
  () => import("@/components/attitude-pie").then((m) => m.AttitudePieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

function ChartSkeleton() {
  return <div className="h-[250px] animate-pulse rounded-md bg-secondary/50" />;
}
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const ATTITUDE_STYLE: Record<string, string> = {
  like: "text-green-400",
  neutral: "text-zinc-400",
  dislike: "text-red-400",
};

const ATTITUDE_LABEL: Record<string, string> = {
  like: "喜欢",
  neutral: "中立",
  dislike: "不喜欢",
};

function EvaluationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const commentId = Number(searchParams.get("commentId")) || 0;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["evaluation-summary", commentId],
    queryFn: () => evaluationApi.summary(commentId),
    enabled: commentId > 0,
  });

  if (!commentId) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        请从评论生成页选择一条评论进行评估
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        加载评估结果中...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        未找到评估数据
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold">评估结果</h2>
        <span className="text-sm text-muted-foreground">
          评论 #{summary.comment_id} · {summary.agent_count} 位评估者 · 综合均分{" "}
          <span className="font-bold text-primary">
            {summary.overall_mean.toFixed(2)}
          </span>
        </span>
      </div>

      {/* Charts grid */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            维度均分雷达图
          </h3>
          <DimensionRadarChart summary={summary} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            各 Agent 评分对比
          </h3>
          <AgentScoreBarChart evaluations={summary.evaluations} />
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            态度分布
          </h3>
          <AttitudePieChart distribution={summary.attitude_distribution} />
        </div>

        {/* Dimension stats table */}
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            维度统计
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-2 text-left">维度</th>
                <th className="pb-2 text-center">均分</th>
                <th className="pb-2 text-center">标准差</th>
                <th className="pb-2 text-center">最低</th>
                <th className="pb-2 text-center">最高</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["场景适配", summary.context_fit],
                  ["风格达成", summary.style_achievement],
                  ["自然度", summary.naturalness],
                  ["互动潜力", summary.engagement_potential],
                ] as const
              ).map(([label, dim]) => (
                <tr key={label} className="border-t border-border">
                  <td className="py-2 font-medium">{label}</td>
                  <td className="py-2 text-center font-bold text-primary">
                    {dim.mean.toFixed(2)}
                  </td>
                  <td className="py-2 text-center text-muted-foreground">
                    {dim.std.toFixed(2)}
                  </td>
                  <td className="py-2 text-center">{dim.min}</td>
                  <td className="py-2 text-center">{dim.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent comments */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Agent 评语
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {summary.evaluations.map((ev) => (
            <div
              key={ev.id}
              className="rounded-md border border-border p-3 text-sm"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{ev.agent_name}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    ATTITUDE_STYLE[ev.attitude],
                  )}
                >
                  {ATTITUDE_LABEL[ev.attitude]}
                </span>
              </div>
              <p className="text-muted-foreground">{ev.reasoning}</p>
              <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                <span>适配:{ev.context_fit}</span>
                <span>风格:{ev.style_achievement}</span>
                <span>自然:{ev.naturalness}</span>
                <span>互动:{ev.engagement_potential}</span>
                <span className="ml-auto font-medium text-foreground">
                  均分:{ev.overall_score.toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-muted-foreground">加载中...</div>
      }
    >
      <EvaluationContent />
    </Suspense>
  );
}
