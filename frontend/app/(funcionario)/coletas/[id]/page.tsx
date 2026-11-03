"use client"

import { use } from "react"
import { BatchDetail } from "@/components/batch-detail"
import { getMyCollectionDetails } from "@/lib/api-client"

export default function MyCollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <BatchDetail id={id} load={getMyCollectionDetails} breadcrumb={["INSPEÇÃO", "MINHAS COLETAS"]} />
}
