/**
 * DimensionRadarChart - 4维度评分雷达图
 *
 * 功能：以雷达图形式展示场景适配度/风格达成度/自然度/互动潜力的均分
 * 数据流：父组件传入 EvaluationSummary → 提取4维度 mean → 渲染雷达图
 */

"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { EvaluationSummary } from "@/lib/api";

const DIMENSION_LABELS: Record<string, string> = {
  context_fit: "场景适配",
  style_achievement: "风格达成",
  naturalness: "自然度",
  engagement_potential: "互动潜力",
};

export function DimensionRadarChart({
  summary,
}: {
  summary: EvaluationSummary;
}) {
  const data = Object.entries(DIMENSION_LABELS).map(([key, label]) => ({
    dimension: label,
    score: summary[key as keyof EvaluationSummary] &&
      typeof summary[key as keyof EvaluationSummary] === "object"
      ? (summary[key as keyof EvaluationSummary] as { mean: number }).mean
      : 0,
    fullMark: 5,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#3f3f46" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fill: "#71717a", fontSize: 10 }}
        />
        <Radar
          name="均分"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
