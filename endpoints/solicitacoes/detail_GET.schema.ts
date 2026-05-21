import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.number(),
});

export type InputType = z.infer<typeof schema>;

export type SolicitacaoAprovacaoItem = {
  id: number;
  status: string;
  comentario: string | null;
  createdAt: Date | null;
  aprovadorNome: string;
};

export type SolicitacaoHistoricoItem = {
  id: number;
  statusAnterior: string | null;
  statusNovo: string;
  comentario: string | null;
  createdAt: Date | null;
  usuarioNome: string;
};

export type SolicitacaoAjusteOperacionalItem = {
  id: number;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  justificativa: string;
  createdAt: Date | null;
  usuarioNome: string;
};

export type OutputType = {
  id: number;
  titulo: string;
  descricao: string | null;
  justificativa: string;
  empresa: string;
  valorEstimado: string | number;
  valorEstimadoTotal: number;
  valorRealCompra: string | number | null;
  valorRealCompraUnitario: string | number | null;
  dataCompra: Date | null;
  fornecedor: string | null;
  canalCompra: string | null;
  observacaoCompra: string | null;
  referenciaPedido: string | null;
  quantidade: number;
  unidade: string | null;
  prioridade: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  setorId: number;
  categoriaId: number;
  solicitanteId: number;
  formaPagamento: string | null;
  parcelas: number | null;
  linkProduto: string | null;
  financeiroJustificativa: string | null;
  metodoPagamento: string | null;
  financeiroAprovadoPor: number | null;
  financeiroAprovadoEm: Date | null;
  setorNome: string;
  categoriaNome: string;
  solicitanteNome: string;
  solicitanteEmail: string;
  financeiroAprovadorNome: string | null;
  financeiroAprovadorEmail: string | null;
  aprovacoes: SolicitacaoAprovacaoItem[];
  historico: SolicitacaoHistoricoItem[];
  ajustesOperacionais: SolicitacaoAjusteOperacionalItem[];
};

export const getSolicitacaoDetail = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  params.append("id", input.id.toString());

  const result = await fetch(`/_api/solicitacoes/detail?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};

