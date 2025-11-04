"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
    ArrowLeft, 
    Download, 
    Image as ImageIcon,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    ChevronRight,
    BarChart3,
} from "lucide-react"
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Cell } from "recharts"

interface ErrorDistributionItem {
    name: string;
    count: number;
}
const CustomErrorTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; 
    return (
      <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-lg text-white">
        <p className="text-sm font-semibold mb-1">{data.name}</p> 
        <p className="text-lg font-bold text-indigo-400">{data.count} ocorrências</p>
      </div>
    );
  }
  return null;
};

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()

    const batchData = {
        id: resolvedParams.id,
        code: "L-2024-001",
        name: "Lote Inspeção Industrial 001",
        description: "Inspeção de qualidade realizada na Linha de Produção A durante o turno matutino. Contém imagens para análise de conformidade.",
        status: "processed", 
        totalCaptures: 5,
        validCaptures: 3,
        invalidCaptures: 2,
        qualityScore: 60.0, 
        createdAt: "2024-10-29T08:30:00",
        totalDefects: 10,
        errorDistribution: [
            { name: "Erros Lógicos", count: 4 },
            { name: "Pin Danificado", count: 3 },
            { name: "Cor Incorreta", count: 1 },
            { name: "Dano Estrutural", count: 1 },
            { name: "Defeito na Haste", count: 1 },
        ] as ErrorDistributionItem[],
        imagesList: [
            { id: 1, isValid: true, detections: 0 },
            { id: 2, isValid: true, detections: 0 },
            { id: 3, isValid: false, detections: 4 },
            { id: 4, isValid: false, detections: 6 },
            { id: 5, isValid: true, detections: 0 },
        ]
    }
    const [selectedImage, setSelectedImage] = useState(batchData.imagesList[0]);
    const [processingType, setProcessingType] = useState("original");
    const getStatusBadge = (status: string) => {
        const styles = {
            processed: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
            pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
        }
        const labels = {
            processed: "Processado",
            pending: "Processamento Pendente",
        }
        const currentStyle = styles[status as keyof typeof styles] || styles.processed;
        const StatusIcon = currentStyle.icon
        
        return (
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-flex items-center gap-2 ${currentStyle.color}`}>
                <StatusIcon className="h-4 w-4" />
                {labels[status as keyof typeof labels] || labels.processed}
            </span>
        )
    }

    const totalDefectTypes = batchData.errorDistribution.length;
    const averageDefectsPerCapture = batchData.totalDefects / batchData.totalCaptures;

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
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3 tracking-wider">
                          <span>ADMIN</span>
                          <ChevronRight className="h-3 w-3 text-gray-500"/>
                          <span>LOTES</span>
                          <ChevronRight className="h-3 w-3 text-gray-500"/>
                          <span className="text-gray-700">{batchData.code}</span>
                      </div>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">{batchData.name}</h1>
                      <p className="text-gray-600 text-sm">{batchData.description}</p>
                  </div>
                  <div className="flex gap-2">
                      {getStatusBadge(batchData.status)}
                      <Button variant="outline">
                          <Download className="h-4 w-4 mr-2" />
                          Exportar Dados
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
                              <p className="text-sm text-gray-600">Capturas Totais</p>
                              <p className="text-3xl font-bold text-gray-900 mt-1">{batchData.totalCaptures}</p>
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
                              <p className="text-sm text-gray-600">Válidas (Conforme)</p>
                              <p className="text-3xl font-bold text-green-600 mt-1">{batchData.validCaptures}</p>
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
                              <p className="text-sm text-gray-600">Inválidas (Defeito)</p>
                              <p className="text-3xl font-bold text-red-600 mt-1">{batchData.invalidCaptures}</p>
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
                              <p className="text-sm text-gray-600">Score de Qualidade</p>
                              <p className="text-3xl font-bold text-gray-900 mt-1">
                                  {batchData.qualityScore.toFixed(1)}%
                              </p>
                          </div>
                          <div className="bg-purple-50 p-3 rounded-lg">
                              <FileText className="h-6 w-6 text-purple-600" />
                          </div>
                      </div>
                  </CardContent>
              </Card>
          </div>

          {/* Cartão de Análise de Defeitos */}
          <div className="grid grid-cols-1 gap-6">
              
              <Card className="lg:col-span-3 border-gray-200"> 
                  <CardHeader>
                      <CardTitle>Análise de Defeitos e Erros</CardTitle>
                      <CardDescription>Distribuição de ocorrências de defeitos por tipo.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {/* Indicadores Chave de Erro */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                              <p className="text-xs text-red-600 font-medium">Ocorrências Totais</p>
                              <p className="text-2xl font-bold text-red-900">{batchData.totalDefects}</p>
                          </div>
                          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                              <p className="text-xs text-indigo-600 font-medium">Tipos Distintos de Defeito</p>
                              <p className="text-2xl font-bold text-indigo-900">{totalDefectTypes}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                              <p className="text-xs text-gray-600 font-medium">Média de Erros por Captura</p>
                              <p className="text-2xl font-bold text-gray-900">{averageDefectsPerCapture.toFixed(2)}</p>
                          </div>
                      </div>

                      {/* Gráfico de Distribuição de Erros */}
                      <div className="h-96 w-full">
                          <h4 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-slate-500" />
                              Distribuição de Ocorrências
                          </h4>
                          <ResponsiveContainer width="100%" height="90%">
                              <BarChart 
                                  data={batchData.errorDistribution} 
                                  layout="vertical"
                                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                              >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis type="number" stroke="#94a3b8" />
                                  <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                                  <Tooltip content={<CustomErrorTooltip />} />
                                  <Bar dataKey="count" fill="#193cb8" radius={[0, 6, 6, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </CardContent>
              </Card>
          </div>

          {/* Galeria de Imagens */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">                
              {/* Bloco Esquerda */}
              <Card className="lg:col-span-1 border-gray-200">
                  <CardHeader>
                      <CardTitle>Galeria de Imagens</CardTitle>
                      <CardDescription>Imagens processadas neste lote ({batchData.totalCaptures} total)</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                      
                      {/* 1. Seletor de Tipo de Processamento */}
                      <div>
                          <label className="text-sm font-medium text-gray-700">Tipo de Visualização</label>
                          <Select value={processingType} onValueChange={setProcessingType}>
                              <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Selecione o processamento" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="original">Original</SelectItem>
                                  <SelectItem value="analise_pins">Análise de Pins</SelectItem>
                                  <SelectItem value="analise_caixa">Análise da Caixa</SelectItem>
                                  <SelectItem value="analise_areas">Análise das Áreas</SelectItem>
                                  <SelectItem value="analise_hastes">Análise de Hastes</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>

                      {/* 2. Lista de Preview */}
                      <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Todas as Capturas</h4>
                          <ScrollArea className="h-96 w-full rounded-md border p-2">
                              <div className="flex flex-col gap-3">
                                  {batchData.imagesList.map((image) => (
                                      <button 
                                          key={image.id} 
                                          className={`w-full p-2 rounded-lg border-2 flex items-center gap-3 text-left transition-all ${
                                              selectedImage.id === image.id 
                                                  ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                                                  : 'border-transparent hover:bg-gray-100'
                                          }`}
                                          onClick={() => setSelectedImage(image)}
                                      >
                                          {/* Mini-preview icon */}
                                          <div className={`flex-shrink-0 w-12 h-12 rounded-md flex items-center justify-center ${
                                              image.isValid ? 'bg-green-100' : 'bg-red-100'
                                          }`}>
                                              <ImageIcon className={`h-5 w-5 ${
                                                  image.isValid ? 'text-green-600' : 'text-red-600'
                                              }`} />
                                          </div>
                                          {/* Info */}
                                          <div>
                                              <p className="text-sm font-semibold text-gray-900">Captura {image.id}</p>
                                              <p className="text-xs text-gray-600">
                                                  {image.isValid 
                                                      ? 'Válida' 
                                                      : `Inválida • ${image.detections} defeitos`
                                                  }
                                              </p>
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </ScrollArea>
                      </div>
                  </CardContent>
              </Card>

              {/* Bloco Direita */}
              <div className="lg:col-span-2 bg-gray-900 rounded-lg min-h-[600px] relative overflow-hidden">
                  {/* @TODO: Refatorar para adicionar a imagem real aqui */}      
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center text-gray-400 p-4 bg-black/50 rounded-lg">
                          <h2 className="text-2xl font-bold text-gray-100">
                              Visualização: Captura {selectedImage.id}
                          </h2>
                          <p className="mt-1 text-gray-400 capitalize">
                              Exibindo: <span className="font-medium text-indigo-400">{processingType.replace("_", " ")}</span>
                          </p>
                          <p className="mt-4 text-sm text-gray-500">(Área de exibição da imagem principal)</p>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    )
}