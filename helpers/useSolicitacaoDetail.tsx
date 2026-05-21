import { useQuery } from "@tanstack/react-query";
import { getSolicitacaoDetail } from "../endpoints/solicitacoes/detail_GET.schema";

export const SOLICITACAO_DETAIL_KEYS = {
  all: ["solicitacao-detail"] as const,
  detail: (id: number) => [...SOLICITACAO_DETAIL_KEYS.all, id] as const,
};

type AutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refetchOnWindowFocus?: boolean;
};

const DETAIL_OPERATIONAL_REFRESH_OPTIONS: AutoRefreshOptions = {
  enabled: true,
  intervalMs: 15_000,
  refetchOnWindowFocus: true,
};

function buildAutoRefreshOptions(options?: AutoRefreshOptions) {
  if (!options?.enabled) {
    return {};
  }

  return {
    staleTime: 10_000,
    refetchInterval: options.intervalMs ?? 15_000,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    refetchIntervalInBackground: false,
  };
}

export function useQuerySolicitacaoDetail(
  id: number | null,
  autoRefresh?: AutoRefreshOptions
) {
  return useQuery({
    queryKey: id ? SOLICITACAO_DETAIL_KEYS.detail(id) : SOLICITACAO_DETAIL_KEYS.all,
    queryFn: () => getSolicitacaoDetail({ id: id as number }),
    enabled: !!id,
    placeholderData: (prev) => prev,
    ...buildAutoRefreshOptions(autoRefresh),
  });
}

export function useQuerySolicitacaoDetailLive(
  id: number | null,
  options?: AutoRefreshOptions
) {
  return useQuerySolicitacaoDetail(id, {
    ...DETAIL_OPERATIONAL_REFRESH_OPTIONS,
    ...options,
  });
}
