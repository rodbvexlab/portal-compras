import { z } from "zod";
import { EmpresaArrayValues } from "../../helpers/schema";

export const schema = z.object({
  empresa: z.enum(EmpresaArrayValues).optional(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  canal: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
});

export type InputType = z.infer<typeof schema>;

export type ConferenciaItem = {
  id: number;
  tipo: "solicitacao";
  data: Date | null;
  item: string;
  setor: string;
  empresa: string;
  canal: string | null;
  metodoPagamento: string | null;
  valorEstimado: number;
  valorReal: number | null;
  parcelas: number | null;
  status: string;
};

export type ConferenciaTotaisPorGrupo = {
  canal: string;
  valor: number;
  qtd: number;
};

export type ConferenciaTotaisPorStatus = {
  status: string;
  valor: number;
  qtd: number;
};

export type ConferenciaOutput = {
  periodo: {
    inicio: string;
    fim: string;
  };
  totais: {
    valorTotal: number;
    qtdItens: number;
    maiorCompra: number;
    totalPorCanal: ConferenciaTotaisPorGrupo[];
    totalPorStatus: ConferenciaTotaisPorStatus[];
  };
  itens: ConferenciaItem[];
};
