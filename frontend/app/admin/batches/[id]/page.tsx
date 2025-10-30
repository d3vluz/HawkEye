"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Download, 
  Calendar, 
  User, 
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  FileText
} from "lucide-react"

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()

  // @TODO: Dados mockados - em produção viriam do backend baseado no ID
  const batchData = {
    id: resolvedParams.id,
    code: "L-2024-001",
    name: "Lote Inspeção Industrial 001",
    description: "Inspeção de qualidade realizada na Linha de Produção A durante o turno matutino. Este lote contém imagens capturadas para análise de conformidade.",
    status: "approved",
    totalImages: 45,
    imagesApproved: 42,
    imagesRejected: 3,
    createdBy: "João Silva",
    createdAt: "2024-10-29T08:30:00",
    processedAt: "2024-10-29T09:15:00",
    approvedBy: "Supervisor Maria",
    notes: "Lote aprovado com 3 imagens descartadas por problemas de iluminação. Qualidade geral: Excelente.",
    imagesList: [
      { id: 1, status: "approved", detections: 3 },
      { id: 2, status: "approved", detections: 2 },
      { id: 3, status: "rejected", detections: 0 },
      { id: 4, status: "approved", detections: 5 },
      { id: 5, status: "approved", detections: 1 },
      { id: 6, status: "approved", detections: 4 },
      { id: 7, status: "rejected", detections: 0 },
      { id: 8, status: "approved", detections: 2 },
    ]
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      approved: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
      pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
      rejected: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle }
    }
    const labels = {
      approved: "Aprovado",
      pending: "Pendente",
      rejected: "Rejeitado"
    }
    const StatusIcon = styles[status as keyof typeof styles].icon
    return (
      <span className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-flex items-center gap-2 ${styles[status as keyof typeof styles].color}`}>
        <StatusIcon className="h-4 w-4" />
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-mono text-gray-500 mb-2">{batchData.code}</p>
            <h1 className="text-3xl font-bold text-gray-900">{batchData.name}</h1>
            <p className="text-gray-600 mt-2 max-w-3xl">{batchData.description}</p>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(batchData.status)}
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Imagens</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{batchData.totalImages}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <ImageIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aprovadas</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{batchData.imagesApproved}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejeitadas</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{batchData.imagesRejected}</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taxa Aprovação</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {((batchData.imagesApproved / batchData.totalImages) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info and Images */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batch Info */}
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle>Informações do Lote</CardTitle>
            <CardDescription>Detalhes e histórico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <User className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Criado por</p>
                  <p className="text-sm text-gray-600">{batchData.createdBy}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Data de Criação</p>
                  <p className="text-sm text-gray-600">
                    {new Date(batchData.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Processado em</p>
                  <p className="text-sm text-gray-600">
                    {new Date(batchData.processedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
                <CheckCircle className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Aprovado por</p>
                  <p className="text-sm text-gray-600">{batchData.approvedBy}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 mb-2">Observações</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {batchData.notes}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Images Gallery */}
        <Card className="lg:col-span-2 border-gray-200">
          <CardHeader>
            <CardTitle>Galeria de Imagens</CardTitle>
            <CardDescription>Imagens processadas neste lote</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {batchData.imagesList.map((image) => (
                <div key={image.id} className="relative group">
                  <div className={`aspect-video rounded-lg overflow-hidden border-2 transition-colors flex items-center justify-center ${
                    image.status === 'approved' 
                      ? 'bg-green-50 border-green-200 hover:border-green-400' 
                      : 'bg-red-50 border-red-200 hover:border-red-400'
                  }`}>
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className={`h-8 w-8 ${
                        image.status === 'approved' ? 'text-green-400' : 'text-red-400'
                      }`} />
                      <span className="text-xs font-medium text-gray-600">
                        Imagem {image.id}
                      </span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    {image.status === 'approved' ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aprovada
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500 hover:bg-red-600">
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejeitada
                      </Badge>
                    )}
                  </div>
                  {image.detections > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="secondary" className="bg-white/90">
                        {image.detections} detecções
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}