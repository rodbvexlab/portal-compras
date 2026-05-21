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

export async function downloadRelatorioExecutivoPdf(
  input: InputType = {},
  init?: RequestInit
): Promise<Blob> {
  const params = new URLSearchParams();

  if (input.startDate) params.append("startDate", input.startDate);
  if (input.endDate) params.append("endDate", input.endDate);
  if (input.setorId) params.append("setorId", String(input.setorId));
  if (input.empresa) params.append("empresa", input.empresa);
  if (input.metodoPagamento) params.append("metodoPagamento", input.metodoPagamento);
  if (input.canalCompra) params.append("canalCompra", input.canalCompra);

  const qs = params.toString();
  const response = await fetch(
    `/_api/relatorios/executivo-pdf${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Não foi possível gerar o relatório PDF.");
  }

  return response.blob();
}
