import { z } from "zod";
import { EmpresaArrayValues } from "../../helpers/schema";

export const schema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  setorId: z.number().int().positive().optional(),
  empresa: z.enum(EmpresaArrayValues).optional(),
  metodoPagamento: z
    .enum([
      "cartao_acseg",
      "cartao_acontrans",
      "cartao_sp",
      "pix",
      "dinheiro",
      "boleto",
      "transferencia",
      "cartao",
      "outro",
    ])
    .optional(),
  canalCompra: z.string().trim().min(1).optional(),
});

export type InputType = z.infer<typeof schema>;

export type SolicitacaoStatsRecentItem = {
  id: number;
  titulo: string;
  descricao: string | null;
  justificativa: string;
  empresa: string;
  valorEstimado: string | number;
  valorEstimadoTotal: number;
  valorRealCompra: string | number | null;
  valorRealCompraUnitario: string | number | null;
  valorRealTotal: number;
  dataCompra: Date | null;
  fornecedor: string | null;
  canalCompra: string | null;
  metodoPagamento: string | null;
  quantidade: number;
  unidade: string | null;
  prioridade: string;
  status: string;
  createdAt: Date | null;
  setorId: number;
  categoriaId: number;
  solicitanteId: number;
  setorNome: string;
  categoriaNome: string;
  solicitanteNome: string;
};

export type ExecutiveKpiBySetorItem = {
  setorNome: string;
  totalRealizado: number;
  quantidade: number;
};

export type ExecutiveKpiByMetodoPagamentoItem = {
  metodoPagamento: string;
  totalRealizado: number;
  quantidade: number;
};

export type ExecutiveKpis = {
  period: {
    startDate: string;
    endDate: string;
    preset: "current_month" | "custom";
  };
  totalGasto: number;
  totalItensComprados: number;
  totalComprasConcluidas: number;
  ticketMedio: number;
  totalEstimado: number;
  totalRealizado: number;
  estimadoVsRealizadoPercentual: number | null;
  gastosPorSetor: ExecutiveKpiBySetorItem[];
  gastosPorMetodoPagamento: ExecutiveKpiByMetodoPagamentoItem[];
};

export type OutputType = {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  recent: SolicitacaoStatsRecentItem[];
  executive: ExecutiveKpis;
};
