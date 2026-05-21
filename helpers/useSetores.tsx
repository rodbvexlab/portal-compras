import { useQuery } from "@tanstack/react-query";
import { getSetores } from "../endpoints/setores/list_GET.schema";

export const SETORES_KEYS = {
  all: ["setores"] as const,
};

export function useQuerySetores() {
  return useQuery({
    queryKey: SETORES_KEYS.all,
    queryFn: () => getSetores({}),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}