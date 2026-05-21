import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import superjson from "superjson";

import {
  getSolicitacoes,
  InputType as ListInput,
} from "../endpoints/solicitacoes/list_GET.schema";
import {
  postCreateSolicitacao,
  InputType as CreateInput,
} from "../endpoints/solicitacoes/create_POST.schema";
import {
  postUpdateStatusSolicitacao,
  InputType as UpdateInput,
} from "../endpoints/solicitacoes/update-status_POST.schema";
import {
  postAdminAdjustSolicitacao,
  InputType as AdminAdjustInput,
} from "../endpoints/solicitacoes/admin-adjust_POST.schema";
import type { SolicitacaoListItem } from "../endpoints/solicitacoes/list_GET.schema";
import type {
  InputType as StatsInput,
  OutputType as StatsOutput,
} from "../endpoints/solicitacoes/stats_GET.schema";
import { SOLICITACAO_DETAIL_KEYS } from "./useSolicitacaoDetail";

export const SOLICITACOES_KEYS = {
  all: ["solicitacoes"] as const,
  lists: () => [...SOLICITACOES_KEYS.all, "list"] as const,
  list: (filters: ListInput) => [...SOLICITACOES_KEYS.lists(), filters] as const,
  stats: () => [...SOLICITACOES_KEYS.all, "stats"] as const,
  statsWithFilters: (filters: StatsInput) =>
    [...SOLICITACOES_KEYS.stats(), filters] as const,
};

type AutoRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
  refetchOnWindowFocus?: boolean;
};

const MONITORING_AUTO_REFRESH_INTERVAL_MS = 30_000;
const OPERATIONAL_AUTO_REFRESH_INTERVAL_MS = 5_000;
const DEFAULT_AUTO_REFRESH_INTERVAL_MS = MONITORING_AUTO_REFRESH_INTERVAL_MS;
const LIVE_AUTO_REFRESH_OPTIONS: AutoRefreshOptions = {
  enabled: true,
  intervalMs: MONITORING_AUTO_REFRESH_INTERVAL_MS,
  refetchOnWindowFocus: true,
};
const OPERATIONAL_AUTO_REFRESH_OPTIONS: AutoRefreshOptions = {
  enabled: true,
  intervalMs: OPERATIONAL_AUTO_REFRESH_INTERVAL_MS,
  refetchOnWindowFocus: true,
};

function buildAutoRefreshOptions(options?: AutoRefreshOptions) {
  if (!options?.enabled) {
    return {};
  }

  const intervalMs = options.intervalMs ?? DEFAULT_AUTO_REFRESH_INTERVAL_MS;

  return {
    staleTime: 10_000,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? true,
    refetchIntervalInBackground: false,
  };
}

async function getStatsSolicitacoesDirect(
  filters: StatsInput = {},
  init?: RequestInit
): Promise<StatsOutput> {
  const params = new URLSearchParams();

  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.setorId) params.append("setorId", String(filters.setorId));
  if (filters.empresa) params.append("empresa", filters.empresa);
  if (filters.metodoPagamento) params.append("metodoPagamento", filters.metodoPagamento);
  if (filters.canalCompra) params.append("canalCompra", filters.canalCompra);

  const qs = params.toString();
  const result = await fetch(`/_api/solicitacoes/stats${qs ? `?${qs}` : ""}`, {
    method: "GET",
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error?: string }>(await result.text());
    throw new Error(errorObject.error || "Erro ao carregar estatísticas");
  }

  return superjson.parse<StatsOutput>(await result.text());
}

export function useQuerySolicitacoes(
  filters: ListInput = {},
  autoRefresh?: AutoRefreshOptions
) {
  return useQuery({
    queryKey: SOLICITACOES_KEYS.list(filters),
    queryFn: () => getSolicitacoes(filters),
    placeholderData: (prev) => prev,
    ...buildAutoRefreshOptions(autoRefresh),
  });
}

export function useQuerySolicitacoesStats(
  filters: StatsInput = {},
  autoRefresh?: AutoRefreshOptions
) {
  return useQuery({
    queryKey: SOLICITACOES_KEYS.statsWithFilters(filters),
    queryFn: () => getStatsSolicitacoesDirect(filters),
    placeholderData: (prev) => prev,
    ...buildAutoRefreshOptions(autoRefresh),
  });
}

export function useQuerySolicitacoesLive(filters: ListInput = {}) {
  return useQuerySolicitacoes(filters, LIVE_AUTO_REFRESH_OPTIONS);
}

export function useQuerySolicitacoesOperational(filters: ListInput = {}) {
  return useQuerySolicitacoes(filters, OPERATIONAL_AUTO_REFRESH_OPTIONS);
}

export function useQuerySolicitacoesLiveWhen(
  filters: ListInput = {},
  enabled = true
) {
  return useQuerySolicitacoes(
    filters,
    enabled ? LIVE_AUTO_REFRESH_OPTIONS : undefined
  );
}

export function useQuerySolicitacoesStatsLive() {
  return useQuerySolicitacoesStats({}, LIVE_AUTO_REFRESH_OPTIONS);
}

export function useMutationCreateSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInput) => postCreateSolicitacao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.lists(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.stats(),
        refetchType: "active",
      });
    },
  });
}

function patchListItemByStatusMutation(
  item: SolicitacaoListItem,
  input: UpdateInput
): SolicitacaoListItem {
  if (Number(item.id) !== Number(input.solicitacaoId)) {
    return item;
  }

  return {
    ...item,
    status: input.statusNovo,
    quantidade:
      typeof input.quantidadeAjustada === "number"
        ? input.quantidadeAjustada
        : item.quantidade,
    valorRealCompraUnitario:
      typeof input.valorRealCompraUnitario === "number"
        ? input.valorRealCompraUnitario
        : item.valorRealCompraUnitario,
    valorRealCompra:
      typeof input.valorRealCompra === "number"
        ? input.valorRealCompra
        : item.valorRealCompra,
    dataCompra: input.dataCompra ? new Date(input.dataCompra) : item.dataCompra,
    canalCompra:
      typeof input.canalCompra === "string" ? input.canalCompra : item.canalCompra,
    observacaoCompra:
      typeof input.observacaoCompra === "string"
        ? input.observacaoCompra
        : item.observacaoCompra,
    metodoPagamento:
      typeof input.metodoPagamento === "string"
        ? input.metodoPagamento
        : item.metodoPagamento,
    parcelas: typeof input.parcelas === "number" ? input.parcelas : item.parcelas,
    linkProduto:
      typeof input.linkProduto === "string" ? input.linkProduto : item.linkProduto,
  };
}

function patchVisibleSolicitacoesLists(
  queryClient: ReturnType<typeof useQueryClient>,
  input: UpdateInput
) {
  const listQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: SOLICITACOES_KEYS.lists() });

  for (const query of listQueries) {
    const queryKey = query.queryKey as readonly unknown[];
    const filters = (queryKey[2] ?? {}) as ListInput;
    const existing = queryClient.getQueryData<SolicitacaoListItem[]>(queryKey);

    if (!existing || !Array.isArray(existing)) {
      continue;
    }

    const patched = existing.map((item) =>
      patchListItemByStatusMutation(item, input)
    );

    const next =
      filters.status && filters.status !== input.statusNovo
        ? patched.filter((item) => item.status === filters.status)
        : patched;

    queryClient.setQueryData(queryKey, next);
  }
}

export function useMutationUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateInput) => postUpdateStatusSolicitacao(data),
    onMutate: async (input) => {
      patchVisibleSolicitacoesLists(queryClient, input);

      queryClient.setQueryData(
        SOLICITACAO_DETAIL_KEYS.detail(Number(input.solicitacaoId)),
        (previous: any) => {
          if (!previous || typeof previous !== "object") {
            return previous;
          }

          return {
            ...previous,
            status: input.statusNovo,
            quantidade:
              typeof input.quantidadeAjustada === "number"
                ? input.quantidadeAjustada
                : previous.quantidade,
            valorRealCompraUnitario:
              typeof input.valorRealCompraUnitario === "number"
                ? input.valorRealCompraUnitario
                : previous.valorRealCompraUnitario,
            valorRealCompra:
              typeof input.valorRealCompra === "number"
                ? input.valorRealCompra
                : previous.valorRealCompra,
            dataCompra: input.dataCompra
              ? new Date(input.dataCompra)
              : previous.dataCompra,
            canalCompra:
              typeof input.canalCompra === "string"
                ? input.canalCompra
                : previous.canalCompra,
            observacaoCompra:
              typeof input.observacaoCompra === "string"
                ? input.observacaoCompra
                : previous.observacaoCompra,
            metodoPagamento:
              typeof input.metodoPagamento === "string"
                ? input.metodoPagamento
                : previous.metodoPagamento,
            parcelas:
              typeof input.parcelas === "number"
                ? input.parcelas
                : previous.parcelas,
            linkProduto:
              typeof input.linkProduto === "string"
                ? input.linkProduto
                : previous.linkProduto,
          };
        }
      );
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.lists(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.stats(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.all,
        refetchType: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.lists(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.stats(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.all,
        refetchType: "active",
      });
    },
  });
}

export function useMutationAdminAdjustSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdminAdjustInput) => postAdminAdjustSolicitacao(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.lists(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.stats(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.all,
        refetchType: "active",
      });
    },
    onError: () => {
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.lists(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACOES_KEYS.stats(),
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.all,
        refetchType: "active",
      });
    },
  });
}
