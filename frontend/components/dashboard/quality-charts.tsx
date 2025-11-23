"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Card } from "@/components/ui/card"

interface QualityChartsProps {
  data: {
    defectTrends: Array<{ name: string; count: number; date: string }>
    errorDistribution: Array<{ name: string; value: number }>
    validityDistribution: Array<{ name: string; value: number; color: string }> 
  }
}

export default function QualityCharts({ data }: QualityChartsProps) {

  const validEntry = data.validityDistribution.find(entry => entry.name === 'Válidas') || { 
    value: 0, 
    color: '#193cb8'
  };
  
  const incorrectEntry = data.validityDistribution.find(entry => entry.name === 'Inválidas') || { 
    value: 0, 
    color: '#ef4444'
  };

  const validPercentage = validEntry.value;
  const incorrectPercentage = incorrectEntry.value;
  const CHART_DRAWING_AREA = 320; 

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6 h-[500px]">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Distribuição de Erros</h3>
          <ResponsiveContainer width="100%" height={CHART_DRAWING_AREA}> 
            <BarChart 
              data={data.errorDistribution} 
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              
              <XAxis 
                type="number" 
                stroke="#94a3b8" 
              />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#94a3b8" 
                width={100}
              />
              
              <Tooltip
                contentStyle={{ backgroundColor: "#e6e6e6", border: "none", borderRadius: "8px", color: "#000000" }}
              />
              <Bar dataKey="value" fill="#193cb8" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 h-[500px]">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Imagens Válidas</h3>
          <div className="relative" style={{ height: CHART_DRAWING_AREA }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.validityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={5} 
                  fill="#8884d8"
                  dataKey="value"
                  labelLine={false}
                >
                  {data.validityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>

            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            >
              <p className="text-4xl font-bold text-slate-900">
                {validPercentage}%
              </p>
              <p className="text-sm text-slate-500">
                Válidos
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex justify-around">
            <div className="text-center">
              <div className="flex items-center justify-center text-sm font-semibold">
                <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: validEntry.color }}></span>
                Válidas
              </div>
              <p className="text-g font-semibold text-slate-700">
                {validPercentage}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-sm font-semibold">
                <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: incorrectEntry.color }}></span>
                Inválidas
              </div>
              <p className="text-g font-semibold text-slate-700">
                {incorrectPercentage}%
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}