"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type LoginTrendChartPoint = {
  hour: string
  failed: number
  success: number
}

export default function LoginTrendChart({ data }: { data: LoginTrendChartPoint[] }) {
  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="font-semibold mb-4">Login Activity (24h)</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="failed" stroke="#ef4444" />
          <Line type="monotone" dataKey="success" stroke="#10b981" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
