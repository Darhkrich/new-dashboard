"use client"

import Link from "next/link"
import { LayoutDashboard, Users, Shield, FileText, Settings2 } from "lucide-react"

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-black text-white p-6 space-y-6">

      <h2 className="text-xl font-bold">Admin Panel</h2>

      <nav className="flex flex-col space-y-4">

        <Link href="/dashboard" className="flex items-center gap-2 hover:text-gray-300">
          <LayoutDashboard size={18} />
          Dashboard
        </Link>

        <Link href="/users" className="flex items-center gap-2 hover:text-gray-300">
          <Users size={18} />
          Users
        </Link>

        <Link href="/security" className="flex items-center gap-2 hover:text-gray-300">
          <Shield size={18} />
          Security
        </Link>

        <Link href="/audit" className="flex items-center gap-2 hover:text-gray-300">
          <FileText size={18} />
          Audit Logs
        </Link>


        <Link href="/settings" className="flex items-center gap-2 hover:text-gray-300">
          <FileText size={18} />
          Settings
        </Link>

        <Link href="/system" className="flex items-center gap-2 hover:text-gray-300">
          <Settings2 size={18} />
          System
        </Link>


      </nav>

    </div>
  )
}
