/**
 * AgentScoreBarChart - 各Agent评分柱状图
 *
 * 功能：对比8个Agent在4个维度上的评分
 * 数据流：父组件传入 EvaluationRecord[] → 按agent分组 → 渲染分组柱状图
 */

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EvaluationRecord } from "@/lib/api";

const DIMENSION_COLORS: Record<string, string> = {
  context_fit: "#3b82f6",
  style_achievement: "#8b5cf6",
  naturalness: "#10b981",
  engagement_potential: "#f59e0b",
};

const DIMENSION_LABELS: Record<string, string> = {
  context_fit: "场景适配",
  style_achievement: "风格达成",
  naturalness: "自然度",
  engagement_potential: "互动潜力",
};

export function AgentScoreBarChart({
  evaluations,
}: {
  evaluations: EvaluationRecord[];
}) {
  const data = evaluations.map((ev) => ({
    agent: ev.agent_name,
    context_fit: ev.context_fit,
    style_achievement: ev.style_achievement,
    naturalness: ev.naturalness,
    engagement_potential: ev.engagement_potential,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="agent" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <YAxis domain={[0, 5]} tick={{ fill: "#71717a", fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
          labelStyle={{ color: "#fafafa" }}
        />
        <Legend />
        {Object.entries(DIMENSION_COLORS).map(([key, color]) => (
          <Bar
            key={key}
            dataKey={key}
            name={DIMENSION_LABELS[key]}
            fill={color}
            radius={[2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
