"use client";
import { useEffect, useState } from "react";
import AdminPanel from "./admin/AdminPanel";
export default function AdminClient() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <AdminPanel /> : <main className="page-shell"><p>Opening the world editor…</p></main>;
}
