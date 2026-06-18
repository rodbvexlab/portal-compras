import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "../helpers/useAuth";
import { useQuerySetores } from "../helpers/useSetores";
import { formatCurrency } from "../helpers/formatters";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import styles from "./orcamento-setor.module.css";

type OrcamentoItem = {
  setor: string;
  limiteMensal: number | null;
  gastoReal: number;
  percentual: number | null;
  totalCompras: number;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const NOW = new Date();

export default function OrcamentoSetor() {
  const { authState } = useAuth();
  const user = authState.type === "authenticated" ? authState.user : null;
  const queryClient = useQueryClient();

  const canAccess =
    user?.role === "diretora_financeiro" || user?.role === "admin";

  const [selectedMes, setSelectedMes] = useState(NOW.getMonth() + 1);
  const [selectedAno, setSelectedAno] = useState(NOW.getFullYear());
  const [editingSetor, setEditingSetor] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const { data: setores, isLoading: isLoadingSetores } = useQuerySetores();

  const setorOptions = useMemo(() => {
    const rawItems = Array.isArray(setores)
      ? setores
      : Array.isArray((setores as any)?.json)
        ? (setores as any).json
        : [];

    return rawItems
      .map((item: any) => ({
        id: Number(item?.id ?? 0),
        nome: String(item?.nome ?? "").trim(),
      }))
      .filter((item: { id: number; nome: string }) => item.id > 0 && item.nome.length > 0)
      .sort((a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [setores]);

  const {
    data: orcamentoData,
    isLoading: isLoadingOrcamento,
  } = useQuery({
    queryKey: ["orcamento-setor", selectedMes, selectedAno],
    queryFn: async (): Promise<OrcamentoItem[]> => {
      const res = await fetch(
        `/_api/orcamento-setor/atual?mes=${selectedMes}&ano=${selectedAno}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao carregar orçamentos");
      }
      return res.json();
    },
    enabled: canAccess,
  });

  const { mutate: definirLimite, isPending: isDefining } = useMutation({
    mutationFn: async (vars: {
      setor: string;
      limiteMensal: number;
      mesReferencia: number;
      anoReferencia: number;
    }) => {
      const res = await fetch("/_api/orcamento-setor/definir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setor: vars.setor,
          limite_mensal: vars.limiteMensal,
          mes_referencia: vars.mesReferencia,
          ano_referencia: vars.anoReferencia,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao definir limite");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["orcamento-setor"] });
      toast.success(`Limite definido para ${vars.setor}`);
      setEditingSetor(null);
      setEditingValue("");
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Não foi possível definir o limite.");
    },
  });

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const isLoading = isLoadingSetores || isLoadingOrcamento;

  const orcamentoMap = new Map(
    (orcamentoData ?? []).map((o) => [o.setor, o])
  );

  const tableRows = setorOptions.map((setor) => {
    const orc = orcamentoMap.get(setor.nome) ?? null;
    return {
      id: setor.id,
      nome: setor.nome,
      limiteMensal: orc?.limiteMensal ?? null,
      gastoReal: orc?.gastoReal ?? 0,
      percentual: orc?.percentual ?? null,
      totalCompras: orc?.totalCompras ?? 0,
    };
  });

  const handleSave = (setorNome: string) => {
    const val = Number(editingValue.replace(",", "."));
    if (!Number.isFinite(val) || val <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    definirLimite({
      setor: setorNome,
      limiteMensal: val,
      mesReferencia: selectedMes,
      anoReferencia: selectedAno,
    });
  };

  const getPercentClass = (pct: number | null) => {
    if (pct === null) return styles.percentNone;
    if (pct > 90) return styles.percentRed;
    if (pct > 70) return styles.percentAmber;
    return styles.percentGreen;
  };

  const getBarClass = (pct: number | null) => {
    if (pct === null) return "";
    if (pct > 90) return styles.progressFillRed;
    if (pct > 70) return styles.progressFillAmber;
    return styles.progressFillGreen;
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Orçamento por Setor - Portal de Compras</title>
      </Helmet>

      <div className={styles.header}>
        <h1 className={styles.title}>Orçamento por Setor</h1>
        <p className={styles.subtitle}>
          Defina limites mensais de gastos por área e acompanhe a utilização em tempo real.
        </p>
      </div>

      <div className={styles.controls}>
        <span className={styles.controlLabel}>Período:</span>
        <select
          className={styles.controlSelect}
          value={selectedMes}
          onChange={(e) => setSelectedMes(Number(e.target.value))}
        >
          {MESES.map((nome, i) => (
            <option key={i + 1} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
        <select
          className={styles.controlSelect}
          value={selectedAno}
          onChange={(e) => setSelectedAno(Number(e.target.value))}
        >
          {[2025, 2026, 2027].map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Setor</th>
              <th>Limite Mensal</th>
              <th>Gasto Atual</th>
              <th>% Utilizado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td><Skeleton style={{ height: "1rem", width: "60%" }} /></td>
                  <td><Skeleton style={{ height: "1rem", width: "80%" }} /></td>
                  <td><Skeleton style={{ height: "1rem", width: "80%" }} /></td>
                  <td><Skeleton style={{ height: "1rem", width: "80%" }} /></td>
                  <td><Skeleton style={{ height: "1rem", width: "60%" }} /></td>
                </tr>
              ))
            ) : tableRows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Nenhum setor cadastrado.
                </td>
              </tr>
            ) : (
              tableRows.map((row) => {
                const isEditing = editingSetor === row.nome;
                const pct = row.percentual;

                return (
                  <tr key={row.id}>
                    <td className={styles.setorCell}>{row.nome}</td>
                    <td className={styles.limiteCell}>
                      {row.limiteMensal !== null
                        ? formatCurrency(row.limiteMensal)
                        : <span className={styles.percentNone}>Sem limite</span>}
                    </td>
                    <td className={styles.gastoCell}>
                      {formatCurrency(row.gastoReal)}
                    </td>
                    <td className={styles.percentCell}>
                      {pct !== null ? (
                        <>
                          <span className={`${styles.percentValue} ${getPercentClass(pct)}`}>
                            {pct.toFixed(1)}%
                          </span>
                          <div className={styles.progressBar}>
                            <div
                              className={`${styles.progressFill} ${getBarClass(pct)}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className={styles.percentNone}>—</span>
                      )}
                    </td>
                    <td className={styles.actionsCell}>
                      {isEditing ? (
                        <div className={styles.inlineEdit}>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className={styles.inlineInput}
                            value={editingValue}
                            placeholder="0,00"
                            autoFocus
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(row.nome);
                              if (e.key === "Escape") {
                                setEditingSetor(null);
                                setEditingValue("");
                              }
                            }}
                          />
                          <Button
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => handleSave(row.nome)}
                            disabled={isDefining}
                          >
                            {isDefining ? "..." : "Salvar"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className={styles.cancelBtn}
                            onClick={() => {
                              setEditingSetor(null);
                              setEditingValue("");
                            }}
                            disabled={isDefining}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className={styles.defineBtn}
                          onClick={() => {
                            setEditingSetor(row.nome);
                            setEditingValue(
                              row.limiteMensal !== null
                                ? String(row.limiteMensal)
                                : ""
                            );
                          }}
                        >
                          {row.limiteMensal !== null ? "Editar limite" : "Definir limite"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
