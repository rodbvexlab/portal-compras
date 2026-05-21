import { z } from "zod";
import superjson from "superjson";
import { EmpresaArrayValues, SolicitacaoStatusArrayValues } from "../../helpers/schema";

export const schema = z.object({
  status: z.enum(SolicitacaoStatusArrayValues).optional(),
  setorId: z.number().optional(),
  solicitanteId: z.number().optional(),
  empresa: z.enum(EmpresaArrayValues).optional(),
  view: z.enum(["mine"]).optional(),
});

export type InputType = z.infer<typeof schema>;

export type SolicitacaoListItem = {
  id: number;
  titulo: string;
  descricao: string | null;
  justificativa: string;
  empresa: string;
  valorEstimado: string | number;
  valorEstimadoTotal: string | number;
  valorRealCompra: string | number | null;
  valorRealCompraUnitario: string | number | null;
  dataCompra: Date | null;
  canalCompra: string | null;
  observacaoCompra: string | null;
  quantidade: number;
  unidade: string | null;
  prioridade: string;
  status: string;
  metodoPagamento: string | null;
  parcelas: number | null;
  linkProduto: string | null;
  createdAt: Date | null;
  setorId: number;
  categoriaId: number;
  solicitanteId: number;
  setorNome: string;
  categoriaNome: string;
  solicitanteNome: string;
};

export type OutputType = SolicitacaoListItem[];

export const getSolicitacoes = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();

  if (input.status) params.append("status", input.status);
  if (input.setorId) params.append("setorId", input.setorId.toString());
  if (input.solicitanteId) {
    params.append("solicitanteId", input.solicitanteId.toString());
  }
  if (input.empresa) params.append("empresa", input.empresa);
  if (input.view) params.append("view", input.view);

  const result = await fetch(`/_api/solicitacoes/list?${params.toString()}`, {
    method: "GET",
    credentials: "include",
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
