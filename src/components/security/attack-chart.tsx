"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type AttackIP = {
  ip_address: string
  attempts: number
}

export default function AttackChart({ data }: { data: AttackIP[] }) {
  return (
    <div className="bg-white shadow rounded p-6">
      <h2 className="font-semibold mb-4">Top Attacking IPs</h2>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <XAxis dataKey="ip_address" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="attempts" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}