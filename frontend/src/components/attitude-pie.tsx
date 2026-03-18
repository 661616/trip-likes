/**
 * AttitudePieChart - Agent态度分布饼图
 *
 * 功能：展示 like / neutral / dislike 的分布比例
 * 数据流：父组件传入 AttitudeDistribution → 渲染饼图
 */

"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { AttitudeDistribution } from "@/lib/api";

const ATTITUDE_CONFIG = [
  { key: "like", label: "喜欢", color: "#10b981" },
  { key: "neutral", label: "中立", color: "#71717a" },
  { key: "dislike", label: "不喜欢", color: "#ef4444" },
];

export function AttitudePieChart({
  distribution,
}: {
  distribution: AttitudeDistribution;
}) {
  const data = ATTITUDE_CONFIG.map(({ key, label }) => ({
    name: label,
    value: distribution[key as keyof AttitudeDistribution],
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={4}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
        >
          {ATTITUDE_CONFIG.map(({ color }, index) => (
            <Cell key={index} fill={color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #27272a" }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
