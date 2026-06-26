import type { CartoesOutput } from "./cartoes_GET.schema";

const CARTOES: CartoesOutput = [
  { id: "cartao_acseg", nome: "Cartao ACSEG - Final 2985", final: "2985" },
  { id: "cartao_acontrans", nome: "Cartao Acontrans - Final 1611", final: "1611" },
  { id: "cartao_sp", nome: "Cartao SP - Final 1611", final: "1611" },
];

export async function handle(_request: Request) {
  return Response.json(CARTOES);
}
