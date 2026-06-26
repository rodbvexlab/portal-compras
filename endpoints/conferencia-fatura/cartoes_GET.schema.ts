import { z } from "zod";

export const schema = z.object({});

export type CartaoOption = {
  id: string;
  nome: string;
  final: string;
};

export type CartoesOutput = CartaoOption[];
