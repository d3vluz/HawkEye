"use client"

import { use } from "react"
import { BatchDetail } from "@/components/batch-detail"
import { getBatchDetails } from "@/lib/api-client"

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <BatchDetail id={id} load={getBatchDetails} breadcrumb={["ADMIN", "LOTES"]} />
}
