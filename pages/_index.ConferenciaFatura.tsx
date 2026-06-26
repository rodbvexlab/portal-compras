import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatStatus, getStatusBadgeVariant, formatCanalCompra } from '../helpers/formatters';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/Select';
import { Skeleton } from '../components/Skeleton';
import { CANAL_COMPRA_OPTIONS } from '../helpers/solicitacoesDomain';
import { toast } from 'sonner';
import type { ConferenciaOutput } from '../endpoints/conferencia-fatura/conferencia_GET.schema';
import type { CartaoOption } from '../endpoints/conferencia-fatura/cartoes_GET.schema';
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

export default function ConferenciaFatura() {
  const navigate = useNavigate();
  const now = new Date();
  const [cartao, setCartao] = useState('');
  const [mes, setMes] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [canal, setCanal] = useState('_all');
  const [shouldFetch, setShouldFetch] = useState(false);
  const yearOptions = useMemo(() => getYearOptions(), []);

  const { data: cartoes } = useQuery<CartaoOption[]>({
    queryKey: ['metodos-pagamento-cartoes'],
    queryFn: async () => {
      const res = await fetch('/_api/metodos-pagamento/cartoes');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const queryParams = useMemo(() => {
    if (!shouldFetch || !cartao) return null;
    const yearNum = Number(ano);
    const monthNum = Number(mes);
    const lastDay = getLastDayOfMonth(yearNum, monthNum);
    return {
      metodoPagamento: cartao,
      dataInicio: `${ano}-${mes}-01`,
      dataFim: `${ano}-${mes}-${String(lastDay).padStart(2, '0')}`,
      canal: canal !== '_all' ? canal : undefined,
    };
  }, [shouldFetch, cartao, mes, ano, canal]);

  const { data, isLoading, isError } = useQuery<ConferenciaOutput>({
    queryKey: ['conferencia-fatura', queryParams],
    queryFn: async () => {
      if (!queryParams) throw new Error('No params');
      const params = new URLSearchParams({
        metodoPagamento: queryParams.metodoPagamento,
        dataInicio: queryParams.dataInicio,
        dataFim: queryParams.dataFim,
      });
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
    if (!cartao) {
      toast.error('Selecione um cartao para conferir.');
      return;
    }
    setShouldFetch(true);
  }, [cartao]);

  const handleFilterChange = useCallback(() => {
    setShouldFetch(false);
  }, []);

  const showResults = shouldFetch && !!data && !isLoading;

  return (
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <div className={styles.filterField}>
          <label>Cartao</label>
          <Select
            value={cartao}
            onValueChange={(v) => { setCartao(v); handleFilterChange(); }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cartao..." />
            </SelectTrigger>
            <SelectContent>
              {(cartoes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome.replace('Final', '****').replace('- ', '  ')}
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
          <Button type="button" onClick={handleConferir} disabled={isLoading || !cartao}>
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
                  <th>Empresa</th>
                  <th>Canal</th>
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
                      <td>{item.empresa}</td>
                      <td>{formatCanalCompra(item.canal)}</td>
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
