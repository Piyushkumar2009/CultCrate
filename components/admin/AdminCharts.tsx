'use client';

import React from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clapperboard, LineChart as LineChartIcon, Sparkles } from 'lucide-react';
import type { ActivityPoint, DistributionSlice, GrowthPoint } from '@/lib/adminAnalytics';
import { PANEL_CLASS, PanelHeader } from './adminUi';

const RED = '#E50914';
const RED_SOFT = '#ff4d56';
const GREEN = '#4EDEAE';
const GRID = 'rgba(255,255,255,0.06)';
const TICK = { fill: '#71717a', fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' } as const;

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}
interface DarkTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  suffix?: string;
}

/** Glass tooltip that matches the rest of the dark UI. */
function DarkTooltip({ active, payload, label, suffix = '' }: DarkTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-white/[0.1] bg-[#0b0f18]/95 px-3 py-2 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      {payload.map((entry, i) => (
        <p key={`${entry.name}-${i}`} className="flex items-center gap-2 font-mono text-xs text-white">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-zinc-400">{entry.name}</span>
          <span className="font-semibold">
            {entry.value}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-black/20 px-6 text-center">
      <p className="max-w-xs text-xs leading-relaxed text-zinc-500">{message}</p>
    </div>
  );
}

interface AdminChartsProps {
  growth: GrowthPoint[];
  activity: ActivityPoint[];
  genres: DistributionSlice[];
  countries: DistributionSlice[];
}

export default function AdminCharts({ growth, activity, genres, countries }: AdminChartsProps) {
  const hasGrowth = growth.some((p) => p.totalCurators > 0);
  const hasActivity = activity.some((p) => p.runs > 0);
  const maxCountry = Math.max(1, ...countries.map((c) => c.count));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {/* Curator growth */}
      <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6 xl:col-span-2`}>
        <PanelHeader
          icon={LineChartIcon}
          eyebrow="Community"
          title="Curator growth"
          subtitle="The red area is how many curators have joined so far. The green line is how many were last seen on each day."
        />
        {hasGrowth ? (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={growth} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={4} />
                <YAxis yAxisId="total" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="seen" orientation="right" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} hide />
                <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                <Area
                  yAxisId="total"
                  type="monotone"
                  dataKey="totalCurators"
                  name="Total curators"
                  stroke={RED_SOFT}
                  strokeWidth={2}
                  fill="url(#growthFill)"
                />
                <Line
                  yAxisId="seen"
                  type="monotone"
                  dataKey="seenThatDay"
                  name="Last seen that day"
                  stroke={GREEN}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart message="Curators will appear here as soon as people start joining CultCrate." />
        )}
      </div>

      {/* Recommendation activity */}
      <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
        <PanelHeader
          icon={Sparkles}
          eyebrow="Engine"
          title="Recommendation activity"
          subtitle="Each bar counts curators whose most recent recommendation run happened that day."
        />
        {hasActivity ? (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED_SOFT} stopOpacity={1} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="runs" name="Recommendation runs" fill="url(#activityFill)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart message="No recommendation runs yet. Activity will show up once curators generate their first picks." />
        )}
      </div>

      {/* Popular genres */}
      <div className={`${PANEL_CLASS} space-y-5 p-5 sm:p-6`}>
        <PanelHeader
          icon={Clapperboard}
          eyebrow="Taste"
          title="Popular genres"
          subtitle="The genres that show up most in everyone's latest recommendations."
        />
        {genres.length > 0 ? (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genres} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="genreFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={TICK} tickLine={false} axisLine={false} width={92} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="Films" fill="url(#genreFill)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart message="Genres will appear here once curators have generated recommendations." />
        )}

        {countries.length > 0 && (
          <div className="space-y-2.5 border-t border-white/[0.06] pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Where the films come from</span>
            {countries.map((c) => (
              <div key={c.label} className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-300">{c.label}</span>
                  <span className="text-zinc-500">{c.share}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#E50914]/60 to-[#ff4d56]"
                    style={{ width: `${Math.max(6, (c.count / maxCountry) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
