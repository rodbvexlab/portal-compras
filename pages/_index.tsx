import React, { Suspense, lazy, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Helmet } from 'react-helmet';
import { useAuth } from '../helpers/useAuth';
import type { SolicitacaoStatus } from '../helpers/schema';
import type { OutputType as DashboardStats } from '../endpoints/solicitacoes/stats_GET.schema';
import { useQuerySolicitacoesStats } from '../helpers/useSolicitacoes';
import { useQuerySetores } from '../helpers/useSetores';
import { downloadRelatorioExecutivoPdf } from '../endpoints/relatorios/executivo-pdf_GET.schema';
import { formatCurrency, formatMetodoPagamento, formatStatus, getStatusBadgeVariant } from '../helpers/formatters';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { SOLICITACAO_STATUS_DISPLAY_ORDER } from '../helpers/solicitacoesDomain';
import {
  CANAL_COMPRA_OPTIONS,
  EMPRESA_OPTIONS,
  METODO_PAGAMENTO_OPTIONS,
} from '../helpers/solicitacoesDomain';
import { toast } from 'sonner';
import styles from './_index.module.css';

const DashboardStatusChart = lazy(() => import('./_index.StatusChart'));

type OrcamentoItem = {
  setor: string;
  limiteMensal: number | null;
  gastoReal: number;
  percentual: number | null;
  totalCompras: number;
};

const PIE_COLORS = ['#c8a256', '#4a5568', '#718096', '#a0aec0', '#cbd5e0'];

const CHART_TOOLTIP_STYLE = {
  background: '#1e2530',
  border: '1px solid #2d3748',
  borderRadius: 6,
  color: '#e2e8f0',
  fontSize: 13,
} as const;

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

type ExecutivePeriodPreset = 'current_month' | 'last_30_days' | 'custom';
type MetodoPagamentoFilterValue = '_all' | (typeof METODO_PAGAMENTO_OPTIONS)[number]['value'];
type CanalCompraFilterValue = '_all' | (typeof CANAL_COMPRA_OPTIONS)[number]['value'];
type EmpresaFilterValue = '_all' | (typeof EMPRESA_OPTIONS)[number]['value'];

const METODO_PAGAMENTO_FILTER_OPTIONS: Array<{ value: MetodoPagamentoFilterValue; label: string }> = [
  { value: '_all', label: 'Todos os métodos' },
  ...METODO_PAGAMENTO_OPTIONS,
];

const CANAL_COMPRA_FILTER_OPTIONS: Array<{ value: CanalCompraFilterValue; label: string }> = [
  { value: '_all', label: 'Todos os canais' },
  ...CANAL_COMPRA_OPTIONS,
];

const EMPRESA_FILTER_OPTIONS: Array<{ value: EmpresaFilterValue; label: string }> = [
  { value: '_all', label: 'Todas as empresas' },
  ...EMPRESA_OPTIONS,
];

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export default function Dashboard() {
  const { authState } = useAuth();

  const user = authState.type === 'authenticated' ? authState.user : null;
  const isExecutiveView =
    user?.role === 'admin' ||
    user?.role === 'financeiro' ||
    user?.role === 'diretora_financeiro' ||
    user?.role === 'diretora_empresa';

  const [periodPreset, setPeriodPreset] = useState<ExecutivePeriodPreset>('current_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [setorFilter, setSetorFilter] = useState<string>('_all');
  const [empresaFilter, setEmpresaFilter] = useState<EmpresaFilterValue>('_all');
  const [metodoPagamentoFilter, setMetodoPagamentoFilter] = useState<MetodoPagamentoFilterValue>('_all');
  const [canalCompraFilter, setCanalCompraFilter] = useState<CanalCompraFilterValue>('_all');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const { data: setores } = useQuerySetores();

  const isDiretoraFinanceiro =
    user?.role === 'diretora_financeiro' || user?.role === 'admin';

  const { data: orcamentoData } = useQuery({
    queryKey: ['orcamento-setor'],
    queryFn: async () => {
      const res = await fetch('/_api/orcamento-setor/atual');
      if (!res.ok) return [] as OrcamentoItem[];
      return res.json() as Promise<OrcamentoItem[]>;
    },
    enabled: isDiretoraFinanceiro,
    staleTime: 2 * 60 * 1000,
  });

  const setorOptions = useMemo(() => {
    const rawItems = Array.isArray(setores)
      ? setores
      : Array.isArray((setores as any)?.json)
        ? (setores as any).json
        : [];

    return rawItems
      .map((item: any) => ({
        id: Number(item?.id ?? 0),
        nome: String(item?.nome ?? '').trim(),
      }))
      .filter((item: { id: number; nome: string }) => item.id > 0 && item.nome.length > 0);
  }, [setores]);

  const statsFilters = useMemo(() => {
    if (!isExecutiveView) return {};

    const optionalFilters: {
      setorId?: number;
      empresa?: Exclude<EmpresaFilterValue, '_all'>;
      metodoPagamento?: Exclude<MetodoPagamentoFilterValue, '_all'>;
      canalCompra?: Exclude<CanalCompraFilterValue, '_all'>;
    } = {};

    if (setorFilter !== '_all') {
      optionalFilters.setorId = Number(setorFilter);
    }

    if (empresaFilter !== '_all') {
      optionalFilters.empresa = empresaFilter;
    }

    if (metodoPagamentoFilter !== '_all') {
      optionalFilters.metodoPagamento = metodoPagamentoFilter;
    }

    if (canalCompraFilter !== '_all') {
      optionalFilters.canalCompra = canalCompraFilter;
    }

    if (periodPreset === 'last_30_days') {
      const today = new Date();
      return {
        startDate: toInputDate(addDays(today, -29)),
        endDate: toInputDate(today),
        ...optionalFilters,
      };
    }

    if (periodPreset === 'custom' && customStartDate && customEndDate) {
      if (customStartDate <= customEndDate) {
        return {
          startDate: customStartDate,
          endDate: customEndDate,
          ...optionalFilters,
        };
      }
    }

    return optionalFilters;
  }, [
    isExecutiveView,
    periodPreset,
    customStartDate,
    customEndDate,
    setorFilter,
    empresaFilter,
    metodoPagamentoFilter,
    canalCompraFilter,
  ]);

  const {
    data: statsRaw,
    isLoading,
    isError: isStatsError,
    error: statsError,
    refetch: refetchStats,
  } = useQuerySolicitacoesStats(statsFilters, {
    enabled: true,
    intervalMs: 30_000,
    refetchOnWindowFocus: true,
  });
  const stats = statsRaw as DashboardStats | undefined;

  const byStatus = useMemo(() => {
    return (stats?.byStatus || {}) as Record<string, number>;
  }, [stats?.byStatus]);

  const totalSolicitacoes = stats?.total || 0;
  const totalPendentesFinanceiro = byStatus['pendente_financeiro'] || 0;
  const totalAguardandoCompra = byStatus['aprovado_para_compra'] || 0;
  const totalCompradas = byStatus['comprado'] || 0;
  const executive = stats?.executive;

  const setorChartData = useMemo(
    () => (executive?.gastosPorSetor ?? []).map((item) => ({
      name: item.setorNome,
      value: item.totalRealizado,
    })),
    [executive?.gastosPorSetor],
  );

  const metodoPagamentoChartData = useMemo(
    () => (executive?.gastosPorMetodoPagamento ?? []).map((item, i) => ({
      name: formatMetodoPagamento(item.metodoPagamento),
      value: item.totalRealizado,
      color: PIE_COLORS[i] ?? PIE_COLORS[PIE_COLORS.length - 1],
    })),
    [executive?.gastosPorMetodoPagamento],
  );

  const chartData = Object.entries(byStatus)
    .filter(([_, count]) => Number(count) > 0)
    .sort(([statusA], [statusB]) => {
      const indexA = SOLICITACAO_STATUS_DISPLAY_ORDER.indexOf(statusA as SolicitacaoStatus);
      const indexB = SOLICITACAO_STATUS_DISPLAY_ORDER.indexOf(statusB as SolicitacaoStatus);

      const safeIndexA = indexA === -1 ? 999 : indexA;
      const safeIndexB = indexB === -1 ? 999 : indexB;

      return safeIndexA - safeIndexB;
    })
    .map(([status, count]) => ({
      status: formatStatus(status),
      count,
    }));

  const chartConfig = {
    count: {
      label: 'Quantidade',
      color: 'var(--primary)',
    },
  };

  const periodLabel = executive
    ? `${new Date(`${executive.period.startDate}T00:00:00`).toLocaleDateString('pt-BR')} até ${new Date(`${executive.period.endDate}T00:00:00`).toLocaleDateString('pt-BR')}`
    : '';

  const handleExportPdf = async () => {
    if (!isExecutiveView || !user) return;

    setIsDownloadingPdf(true);
    try {
      const blob = await downloadRelatorioExecutivoPdf(statsFilters);
      const pdfUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = pdfUrl;
      anchor.download = `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(pdfUrl);
      toast.success('Relatório PDF gerado com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível gerar o relatório PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Dashboard - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>Bem-vindo, {user?.displayName}</h1>
        <p className={styles.subtitle}>
          {isExecutiveView
            ? 'Visão executiva com indicadores financeiros reais de compras.'
            : 'Acompanhe o resumo operacional das solicitações de compra.'}
        </p>

        {isExecutiveView && (
          <div className={styles.periodFilter}>
            <div className={styles.periodFilterOptions}>
              <button
                type="button"
                className={`${styles.periodButton} ${periodPreset === 'current_month' ? styles.periodButtonActive : ''}`}
                onClick={() => setPeriodPreset('current_month')}
              >
                Mês atual
              </button>
              <button
                type="button"
                className={`${styles.periodButton} ${periodPreset === 'last_30_days' ? styles.periodButtonActive : ''}`}
                onClick={() => setPeriodPreset('last_30_days')}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                className={`${styles.periodButton} ${periodPreset === 'custom' ? styles.periodButtonActive : ''}`}
                onClick={() => setPeriodPreset('custom')}
              >
                Personalizado
              </button>
            </div>

            {periodPreset === 'custom' && (
              <div className={styles.customDateRow}>
                <label className={styles.dateField}>
                  <span>Início</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </label>
                <label className={styles.dateField}>
                  <span>Fim</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </label>
              </div>
            )}

            <div className={styles.executiveFilterRow}>
              <div className={styles.executiveFilterField}>
                <label>Setor</label>
                <Select value={setorFilter} onValueChange={setSetorFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todos os setores</SelectItem>
                    {setorOptions.map((setor) => (
                      <SelectItem key={setor.id} value={String(setor.id)}>
                        {setor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.executiveFilterField}>
                <label>Empresa</label>
                <Select
                  value={empresaFilter}
                  onValueChange={(value) => setEmpresaFilter(value as EmpresaFilterValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMPRESA_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.executiveFilterField}>
                <label>Método</label>
                <Select
                  value={metodoPagamentoFilter}
                  onValueChange={(value) => setMetodoPagamentoFilter(value as MetodoPagamentoFilterValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    {METODO_PAGAMENTO_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.executiveFilterField}>
                <label>Canal</label>
                <Select
                  value={canalCompraFilter}
                  onValueChange={(value) => setCanalCompraFilter(value as CanalCompraFilterValue)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os canais" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_COMPRA_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.executiveFilterAction}>
                <Button type="button" onClick={handleExportPdf} disabled={isDownloadingPdf || isLoading}>
                  {isDownloadingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.kpiHeader}>
        <h2 className={styles.kpiTitle}>{isExecutiveView ? 'Indicadores Executivos' : 'Indicadores de Operação'}</h2>
        <p className={styles.kpiSubtitle}>
          {isExecutiveView
            ? 'KPIs financeiros e de eficiência para decisão de gestão.'
            : 'Resumo quantitativo para triagem diária de solicitações.'}
        </p>
      </div>

      {isStatsError && (
        <div className={styles.dashboardError} role="alert">
          <div>
            <h2>Não foi possível carregar os indicadores</h2>
            <p>
              {statsError instanceof Error
                ? statsError.message
                : 'Falha ao carregar os dados do Dashboard.'}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => refetchStats()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isStatsError && (
      <div className={`${styles.statsGrid} ${isExecutiveView ? styles.executiveStatsGrid : ''}`}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>{isExecutiveView ? 'Total Gasto no Período' : 'Total Solicitações'}</h3>
            {isExecutiveView && <span className={`${styles.statPill} ${styles.pillFinanceiro}`}>Financeiro</span>}
          </div>
          {isLoading ? (
            <Skeleton className={styles.skeletonStat} />
          ) : (
            <div className={styles.statValueWrap}>
              <div className={`${styles.statValue} ${isExecutiveView ? styles.executiveStatValue : ''}`}>
                {isExecutiveView ? formatCurrency(executive?.totalGasto ?? 0) : totalSolicitacoes}
              </div>
            </div>
          )}
          {isExecutiveView && <p className={styles.statHint}>Soma das compras com valor real registrado.</p>}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>{isExecutiveView ? 'Itens Comprados' : 'Pendentes Financeiro'}</h3>
            {isExecutiveView && <span className={`${styles.statPill} ${styles.pillVolume}`}>Volume</span>}
          </div>
          {isLoading ? (
            <Skeleton className={styles.skeletonStat} />
          ) : (
            <div className={styles.statValueWrap}>
              <div className={`${styles.statValue} ${isExecutiveView ? styles.executiveStatValue : ''}`}>
                {isExecutiveView ? executive?.totalItensComprados ?? 0 : totalPendentesFinanceiro}
              </div>
            </div>
          )}
          {isExecutiveView && <p className={styles.statHint}>Soma das quantidades compradas no período.</p>}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>{isExecutiveView ? 'Ticket Médio' : 'Aguardando Compra'}</h3>
            {isExecutiveView && <span className={`${styles.statPill} ${styles.pillEficiencia}`}>Eficiência</span>}
          </div>
          {isLoading ? (
            <Skeleton className={styles.skeletonStat} />
          ) : (
            <div className={styles.statValueWrap}>
              <div className={`${styles.statValue} ${isExecutiveView ? styles.executiveStatValue : ''}`}>
                {isExecutiveView ? formatCurrency(executive?.ticketMedio ?? 0) : totalAguardandoCompra}
              </div>
            </div>
          )}
          {isExecutiveView && <p className={styles.statHint}>Média de gasto por compra concluída.</p>}
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <h3>{isExecutiveView ? 'Estimado x Realizado' : 'Compradas'}</h3>
            {isExecutiveView && <span className={`${styles.statPill} ${styles.pillPlanejamento}`}>Planejamento</span>}
          </div>
          {isLoading ? (
            <Skeleton className={styles.skeletonStat} />
          ) : (
            <>
              <div className={styles.statValueWrap}>
                <div className={`${styles.statValue} ${isExecutiveView ? styles.executiveStatValue : ''}`}>
                  {isExecutiveView
                    ? `${(executive?.estimadoVsRealizadoPercentual ?? 0).toFixed(1)}%`
                    : totalCompradas}
                </div>
              </div>
              {isExecutiveView && (
                <p className={styles.statSubValue}>
                  Estimado: {formatCurrency(executive?.totalEstimado ?? 0)} | Realizado:{' '}
                  {formatCurrency(executive?.totalRealizado ?? 0)}
                </p>
              )}
            </>
          )}
          {isExecutiveView && <p className={styles.statHint}>Relação entre valor estimado e gasto efetivo.</p>}
        </div>
      </div>
      )}

      {!isStatsError && (isExecutiveView ? (
        <div className={`${styles.contentGrid} ${styles.executiveContentGrid}`}>
          <div className={`${styles.chartSection} ${styles.sectionShell} ${styles.executiveSection}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Gastos por Setor
                {isDiretoraFinanceiro && (() => {
                  const criticos = (orcamentoData ?? []).filter(
                    (o) => o.percentual !== null && o.percentual > 90
                  );
                  return criticos.length > 0 ? (
                    <span className={styles.orcamentoAlertBadge}>
                      ⚠ {criticos.length} setor{criticos.length > 1 ? 'es' : ''} com orçamento crítico
                    </span>
                  ) : null;
                })()}
              </h2>
              <p className={styles.sectionMeta}>Período: {periodLabel}</p>
            </div>
            <p className={styles.sectionDescription}>
              Distribuição dos gastos reais por área para apoiar decisões orçamentárias.
            </p>
            {!isLoading && setorChartData.length > 0 && (
              <div className={styles.execChartWrapper}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    layout="vertical"
                    data={setorChartData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <XAxis
                      type="number"
                      tickFormatter={formatCurrencyShort}
                      tick={{ fill: '#8b9299', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: '#e2e8f0', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value: any) => [formatCurrency(value as number), 'Realizado']}
                      labelStyle={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: '#c8a256' }}
                      cursor={{ fill: 'rgba(200,162,86,0.06)' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {setorChartData.map((_, i) => (
                        <Cell key={i} fill="#c8a256" fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className={`${styles.tableWrapper} ${styles.executiveTableWrapper}`}>
              <table className={`${styles.table} ${styles.executiveTable}`}>
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Total Realizado</th>
                    <th>Compras</th>
                    {isDiretoraFinanceiro && <th>Orçamento</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        {isDiretoraFinanceiro && <td><Skeleton className={styles.skeletonCell} /></td>}
                      </tr>
                    ))
                  ) : (
                    executive?.gastosPorSetor?.map((item, index) => {
                      const orc = isDiretoraFinanceiro
                        ? (orcamentoData ?? []).find((o) => o.setor === item.setorNome)
                        : undefined;
                      const pct = orc?.percentual ?? null;
                      const pctColor =
                        pct === null ? '' :
                        pct > 90 ? styles.orcamentoPercentRed :
                        pct > 70 ? styles.orcamentoPercentAmber :
                        styles.orcamentoPercentGreen;
                      const barColor =
                        pct === null ? '' :
                        pct > 90 ? styles.progressFillRed :
                        pct > 70 ? styles.progressFillAmber :
                        styles.progressFillGreen;

                      return (
                        <tr key={item.setorNome}>
                          <td>
                            <div className={styles.tablePrimaryCell}>
                              <span className={styles.rankBadge}>{index + 1}</span>
                              <span>{item.setorNome}</span>
                            </div>
                          </td>
                          <td>{formatCurrency(item.totalRealizado)}</td>
                          <td>{item.quantidade}</td>
                          {isDiretoraFinanceiro && (
                            <td>
                              {orc?.limiteMensal ? (
                                <>
                                  <span className={pctColor}>{pct!.toFixed(1)}%</span>
                                  <div className={styles.progressBar}>
                                    <div
                                      className={`${styles.progressFill} ${barColor}`}
                                      style={{ width: `${Math.min(pct!, 100)}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span className={styles.orcamentoNone}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                  {!isLoading && (executive?.gastosPorSetor?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={isDiretoraFinanceiro ? 4 : 3} className={styles.emptyCell}>Nenhum gasto real no período</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${styles.recentSection} ${styles.sectionShell} ${styles.executiveSection}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Gastos por Método de Pagamento</h2>
              <p className={styles.sectionMeta}>Período: {periodLabel}</p>
            </div>
            <p className={styles.sectionDescription}>
              Leitura rápida da concentração financeira por meio de pagamento aprovado.
            </p>
            {!isLoading && metodoPagamentoChartData.length > 0 && (
              <div className={styles.execChartWrapper} style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                <div style={{ flexShrink: 0 }}>
                  <ResponsiveContainer width={220} height={220}>
                    <PieChart>
                      <Pie
                        data={metodoPagamentoChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {metodoPagamentoChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#a0aec0', minWidth: 0 }}>
                  {metodoPagamentoChartData.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, flexShrink: 0 }} />
                      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name}
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#e2e8f0', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', paddingLeft: 8 }}>
                        {formatCurrency(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`${styles.tableWrapper} ${styles.executiveTableWrapper}`}>
              <table className={`${styles.table} ${styles.executiveTable}`}>
                <thead>
                  <tr>
                    <th>Método</th>
                    <th>Total Realizado</th>
                    <th>Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                      </tr>
                    ))
                  ) : (
                    executive?.gastosPorMetodoPagamento?.map((item, index) => (
                      <tr key={item.metodoPagamento}>
                        <td>
                          <div className={styles.tablePrimaryCell}>
                            <span className={styles.rankBadge}>{index + 1}</span>
                            <span>{formatMetodoPagamento(item.metodoPagamento)}</span>
                          </div>
                        </td>
                        <td>{formatCurrency(item.totalRealizado)}</td>
                        <td>{item.quantidade}</td>
                      </tr>
                    ))
                  )}
                  {!isLoading && (executive?.gastosPorMetodoPagamento?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.emptyCell}>Nenhum método com gasto no período</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.contentGrid}>
          <div className={`${styles.chartSection} ${styles.sectionShell}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Solicitações por Status</h2>
              <p className={styles.sectionMeta}>Total: {totalSolicitacoes}</p>
            </div>
            <p className={styles.sectionDescription}>
              Distribuição atual para priorizar rapidamente gargalos de aprovação e compra.
            </p>
            <div className={styles.chartWrapper}>
              {isLoading ? (
                <Skeleton className={styles.skeletonChart} />
              ) : (
                <Suspense fallback={<Skeleton className={styles.skeletonChart} />}>
                  <DashboardStatusChart data={chartData} config={chartConfig} />
                </Suspense>
              )}
            </div>
          </div>

          <div className={`${styles.recentSection} ${styles.sectionShell}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Solicitações Recentes</h2>
              <p className={styles.sectionMeta}>Pendentes financeiro: {totalPendentesFinanceiro}</p>
            </div>
            <p className={styles.sectionDescription}>
              Lista de entrada com foco em identificação rápida de exceções e status críticos.
            </p>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Setor</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                        <td><Skeleton className={styles.skeletonCell} /></td>
                      </tr>
                    ))
                  ) : (
                    stats?.recent?.map((item) => (
                      <tr key={item.id}>
                        <td className={styles.truncate}>{item.titulo}</td>
                        <td>{item.setorNome}</td>
                        <td>{formatCurrency(item.valorEstimadoTotal ?? item.valorEstimado)}</td>
                        <td>
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {formatStatus(item.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                  {!isLoading && stats?.recent?.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.emptyCell}>Nenhuma solicitação recente</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}



