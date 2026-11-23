import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useI18n } from '../../i18n'
import {
  formatAxisDate,
  formatNumber
} from '../../lib/format'
import { useWorkspaceData } from '../../workspace/WorkspaceProvider'

interface TooltipEntry {
  dataKey?: string | number
  value?: number | string
}

interface ChartTooltipProps {
  active?: boolean
  label?: string
  payload?: TooltipEntry[]
}

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  const { t, locale } = useI18n()

  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-xl border border-white/10 bg-[#1b1723]/95 px-3 py-2.5 shadow-2xl backdrop-blur-sm">
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => {
          const isAttendance = entry.dataKey === 'attendance'
          return (
            <div
              key={String(entry.dataKey)}
              className="flex items-center justify-between gap-4 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-muted">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${
                    isAttendance ? 'bg-[#0e9f7a]' : 'bg-[#8b5cf6]'
                  }`}
                />
                {t(
                  isAttendance
                    ? 'dashboard.attendanceLabel'
                    : 'dashboard.registrationsLabel'
                )}
              </span>
              <span className="font-display font-semibold text-primary">
                {formatNumber(Number(entry.value ?? 0), locale)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AttendanceChart() {
  const { t, locale } = useI18n()
  const snapshot = useWorkspaceData()

  const data = snapshot.attendanceSeries.map((point) => ({
    ...point,
    label: formatAxisDate(point.date, locale)
  }))
  const hasActivity = data.some(
    (point) => point.attendance > 0 || point.registrations > 0
  )

  return (
    <section className="lavender-panel relative min-w-0 overflow-hidden rounded-[26px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-semibold text-[#261d38] sm:text-[20px]">
            {t('dashboard.attendanceTitle')}
          </h2>
          <p className="mt-1 text-[11px] text-[#74688a]">
            {t('dashboard.attendanceSubtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!hasActivity ? (
            <span className="rounded-full border border-[#261d38]/10 bg-white/45 px-2.5 py-1 text-[10px] font-medium text-[#6c5e83]">
              {t('dashboard.noActivity')}
            </span>
          ) : null}
          <div className="flex items-center gap-3 text-[10px] font-medium text-[#5f5275]">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#0e9f7a]"
              />
              {t('dashboard.attendanceLabel')}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-[#8b5cf6]"
              />
              {t('dashboard.registrationsLabel')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-[280px] w-full sm:h-[310px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="attendance-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e9f7a" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#0e9f7a" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="registrations-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.24} />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#b9a8d6"
              strokeOpacity={0.55}
              strokeDasharray="3 7"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#65597a', fontSize: 10 }}
              tickMargin={11}
              minTickGap={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={40}
              allowDecimals={false}
              tick={{ fill: '#817596', fontSize: 10 }}
            />
            <Tooltip
              cursor={{ stroke: '#7c3aed', strokeDasharray: '4 4', strokeOpacity: 0.5 }}
              content={<ChartTooltip />}
            />
            <Area
              type="monotone"
              dataKey="registrations"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#registrations-area)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#8b5cf6',
                stroke: '#f6f0ff',
                strokeWidth: 2
              }}
            />
            <Area
              type="monotone"
              dataKey="attendance"
              stroke="#0e9f7a"
              strokeWidth={2.6}
              fill="url(#attendance-area)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#0e9f7a',
                stroke: '#f6fff9',
                strokeWidth: 2
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
