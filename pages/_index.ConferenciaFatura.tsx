import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatStatus, getStatusBadgeVariant, formatCanalCompra } from '../helpers/formatters';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { CANAL_COMPRA_OPTIONS, EMPRESA_OPTIONS } from '../helpers/solicitacoesDomain';
import { toast } from 'sonner';
import type { ConferenciaOutput } from '../endpoints/conferencia-fatura/conferencia_GET.schema';
import styles from './_index.ConferenciaFatura.module.css';

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Marco' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 2; y--) {
    years.push(String(y));
  }
  return years;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const CARTAO_FINAL_MAP: Record<string, string> = {
  cartao_acseg: '**** 2985',
  cartao_acontrans: '**** 1611',
  cartao_sp: '**** 1611',
};

function formatCartaoFinal(metodoPagamento: string | null): string {
  if (!metodoPagamento) return '—';
  return CARTAO_FINAL_MAP[metodoPagamento] ?? '—';
}

export default function ConferenciaFatura() {
  const navigate = useNavigate();
  const now = new Date();
  const [empresa, setEmpresa] = useState('_all');
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [canal, setCanal] = useState('_all');
  const [shouldFetch, setShouldFetch] = useState(false);
  const yearOptions = useMemo(() => getYearOptions(), []);

  const queryParams = useMemo(() => {
    if (!shouldFetch) return null;
    const yearNum = Number(ano);
    const monthNum = Number(mes);
    const lastDay = getLastDayOfMonth(yearNum, monthNum);
    return {
      empresa: empresa !== '_all' ? empresa : undefined,
      dataInicio: `${ano}-${mes}-01`,
      dataFim: `${ano}-${mes}-${String(lastDay).padStart(2, '0')}`,
      canal: canal !== '_all' ? canal : undefined,
    };
  }, [shouldFetch, empresa, mes, ano, canal]);

  const { data, isLoading, isError } = useQuery<ConferenciaOutput>({
    queryKey: ['conferencia-fatura', queryParams],
    queryFn: async () => {
      if (!queryParams) throw new Error('No params');
      const params = new URLSearchParams({
        dataInicio: queryParams.dataInicio,
        dataFim: queryParams.dataFim,
      });
      if (queryParams.empresa) params.set('empresa', queryParams.empresa);
      if (queryParams.canal) params.set('canal', queryParams.canal);

      const res = await fetch(`/_api/conferencia-fatura?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao buscar dados');
      }
      return res.json();
    },
    enabled: !!queryParams,
    staleTime: 30_000,
  });

  const handleConferir = useCallback(() => {
    setShouldFetch(true);
  }, []);

  const handleFilterChange = useCallback(() => {
    setShouldFetch(false);
  }, []);

  const showResults = shouldFetch && !!data && !isLoading;

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <label>Empresa</label>
          <Select
            value={empresa}
            onValueChange={(v) => { setEmpresa(v); handleFilterChange(); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {EMPRESA_OPTIONS.map((e) => (
                <SelectItem key={e.value} value={e.value}>
                  {e.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterField}>
          <label>Mes</label>
          <Select value={mes} onValueChange={(v) => { setMes(v); handleFilterChange(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterField}>
          <label>Ano</label>
          <Select value={ano} onValueChange={(v) => { setAno(v); handleFilterChange(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterField}>
          <label>Canal</label>
          <Select value={canal} onValueChange={(v) => { setCanal(v); handleFilterChange(); }}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os canais</SelectItem>
              {CANAL_COMPRA_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={styles.filterAction}>
          <Button type="button" onClick={handleConferir} disabled={isLoading}>
            {isLoading ? 'Conferindo...' : 'Conferir'}
          </Button>
        </div>
      </div>

      {isError && (
        <div className={styles.errorBox}>
          Nenhuma compra encontrada para este periodo ou erro ao buscar dados.
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingGrid}>
          <Skeleton style={{ height: 100 }} />
          <Skeleton style={{ height: 100 }} />
          <Skeleton style={{ height: 100 }} />
        </div>
      )}

      {showResults && (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Total da fatura</span>
              <span className={styles.kpiValue}>{formatCurrency(data.totais.valorTotal)}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Qtd de compras</span>
              <span className={styles.kpiValue}>{data.totais.qtdItens}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Maior compra</span>
              <span className={styles.kpiValue}>{formatCurrency(data.totais.maiorCompra)}</span>
            </div>
          </div>

          {data.totais.totalPorCanal.length > 0 && (
            <div className={styles.breakdownBar}>
              {data.totais.totalPorCanal.map((item) => (
                <span key={item.canal} className={styles.breakdownChip}>
                  {item.canal} <strong>{formatCurrency(item.valor)}</strong>
                </span>
              ))}
            </div>
          )}

          <div className={styles.tableShell}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Item</th>
                  <th>Canal</th>
                  <th>Cartao</th>
                  <th>Valor real</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((item) => {
                  const hasRealValue = item.valorReal !== null && item.valorReal > 0;
                  const displayValue = hasRealValue ? item.valorReal! : item.valorEstimado;

                  return (
                    <tr
                      key={`${item.tipo}-${item.id}`}
                      className={styles.clickableRow}
                      onClick={() => navigate(`/solicitacoes/${item.id}`)}
                    >
                      <td>
                        {item.data
                          ? new Date(item.data).toLocaleDateString('pt-BR')
                          : '-'}
                      </td>
                      <td className={styles.itemCell}>{item.item}</td>
                      <td>{formatCanalCompra(item.canal)}</td>
                      <td className={styles.cartaoCell}>{formatCartaoFinal(item.metodoPagamento)}</td>
                      <td className={styles.valorCell}>
                        <span className={hasRealValue ? styles.valorReal : styles.valorEstimado}>
                          {formatCurrency(displayValue)}
                        </span>
                        {!hasRealValue && (
                          <span className={styles.estimadoBadge}>estimado</span>
                        )}
                      </td>
                      <td>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {formatStatus(item.status)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {data.itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.emptyCell}>
                      Nenhuma compra encontrada para este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
              {data.itens.length > 0 && (
                <tfoot>
                  <tr className={styles.footerRow}>
                    <td colSpan={4} className={styles.footerLabel}>TOTAL</td>
                    <td className={styles.footerValue}>{formatCurrency(data.totais.valorTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
