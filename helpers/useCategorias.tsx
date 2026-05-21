import { useQuery } from "@tanstack/react-query";
import { getCategorias } from "../endpoints/categorias/list_GET.schema";

export const CATEGORIAS_KEYS = {
  all: ["categorias"] as const,
};

export function useQueryCategorias() {
  return useQuery({
    queryKey: CATEGORIAS_KEYS.all,
    queryFn: () => getCategorias({}),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}