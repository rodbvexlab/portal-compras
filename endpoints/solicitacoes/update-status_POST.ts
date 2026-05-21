import { schema, OutputType } from "./update-status_POST.schema";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import type { MetodoPagamento, SolicitacaoStatus } from "../../helpers/schema";
import {
  calculateEstimatedTotal,
  calculateRealTotal,
  hasPositiveAmount,
  normalizeQuantity,
  resolveRealUnitario,
  roundCurrency,
  toFiniteNumber,
} from "../../helpers/monetary";
import {
  canRunAdminOperationalAdjustment,
  isBoardTransition,
  isCardPaymentMethod,
  isFinancialApprovalPath,
  isFinancialTransition,
  isTiCompraTransition,
  normalizeCanalCompra,
  OPERATIONAL_ADJUSTABLE_STATUSES,
  REQUESTER_CANCEL_ALLOWED_CURRENT_STATUSES,
  TI_STATUS_TRANSITIONS,
  UPDATE_STATUS_ALLOWED_NEXT_BY_ROLE,
} from "../../helpers/solicitacoesDomain";
import { notifySolicitacaoStatusChange } from "../../helpers/solicitacaoNotifications";
import { notifySolicitacaoStatusEmailChange } from "../../helpers/solicitacaoEmailNotifications";

type AdjustmentChange = {
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
};

type AdjustmentUpdatePayload = {
  titulo: string;
  descricao: string | null;
  valorEstimado: string;
  quantidade: number;
  valorRealCompraUnitario: string | null;
  valorRealCompra: string | null;
  metodoPagamento: MetodoPagamento | null;
  formaPagamento: "pix" | "boleto" | "transferencia" | "cartao" | "outro" | null;
  parcelas: number | null;
  dataCompra: Date | null;
  fornecedor: string | null;
  canalCompra: string | null;
  referenciaPedido: string | null;
  observacaoCompra: string | null;
  linkProduto: string | null;
};

const STATUS_WITH_OPERATIONAL_ADJUSTMENT = new Set<SolicitacaoStatus>([
  ...OPERATIONAL_ADJUSTABLE_STATUSES,
]);

function parseRequestPayload(rawText: string) {
  const text = rawText.replace(/^\uFEFF/, "").trim();

  try {
    return superjson.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function requireComment(comentario?: string | null) {
  if (!comentario || comentario.trim() === "") {
    throw new Error("Justificativa obrigatoria para esta acao.");
  }
}

function normalizeOptionalString(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeOptionalUrl(value?: string | null) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    return parsed.toString();
  } catch {
    throw new Error("Link do produto invalido.");
  }
}

function toLegacyFormaPagamento(
  metodoPagamento?: string | null
): "pix" | "boleto" | "transferencia" | "cartao" | "outro" | null {
  if (!metodoPagamento) return null;

  if (
    metodoPagamento === "cartao_acseg" ||
    metodoPagamento === "cartao_acontrans" ||
    metodoPagamento === "cartao_sp" ||
    metodoPagamento === "cartao"
  ) {
    return "cartao";
  }

  if (metodoPagamento === "dinheiro" || metodoPagamento === "outro") {
    return "outro";
  }

  if (
    metodoPagamento === "pix" ||
    metodoPagamento === "boleto" ||
    metodoPagamento === "transferencia"
  ) {
    return metodoPagamento;
  }

  return "outro";
}

function toComparableValue(value: string | number | null | Date | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return roundCurrency(value).toFixed(2);
  if (typeof value === "string") return value;
  return value ?? null;
}

function pushChange(
  changes: AdjustmentChange[],
  campo: string,
  previousValue: string | number | null | Date | undefined,
  nextValue: string | number | null | Date | undefined
) {
  const previous = toComparableValue(previousValue);
  const next = toComparableValue(nextValue);
  if (previous === next) return;

  changes.push({
    campo,
    valorAnterior: previous === null ? null : String(previous),
    valorNovo: next === null ? null : String(next),
  });
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role === "financeiro") {
      return new Response(
        superjson.stringify({
          error: "Perfil financeiro possui acesso somente leitura.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rawText = await request.text();
    const json = parseRequestPayload(rawText);
    const input = schema.parse(json);

    const solicitacao = await db
      .selectFrom("solicitacoes")
      .select([
        "id",
        "titulo",
        "descricao",
        "status",
        "solicitanteId",
        "setorId",
        "valorEstimado",
        "quantidade",
        "valorRealCompra",
        "valorRealCompraUnitario",
        "metodoPagamento",
        "parcelas",
        "dataCompra",
        "fornecedor",
        "canalCompra",
        "referenciaPedido",
        "observacaoCompra",
        "linkProduto",
      ])
      .where("id", "=", input.solicitacaoId)
      .executeTakeFirst();

    if (!solicitacao) {
      throw new Error("Solicitacao nao encontrada.");
    }

    const statusAtual = solicitacao.status as SolicitacaoStatus;
    const statusNovo = input.statusNovo as SolicitacaoStatus;
    let finalStatus: SolicitacaoStatus = statusNovo;

    const comentario = normalizeOptionalString(input.comentario);
    const referenciaPedido = normalizeOptionalString(input.referenciaPedido);
    const observacaoCompra = normalizeOptionalString(input.observacaoCompra);

    const isStatusPreservingRequest = statusAtual === statusNovo;
    const isAdminOperationalAdjustmentRequest =
      user.role === "admin" &&
      canRunAdminOperationalAdjustment({ statusAtual, statusNovo });
    const isTiOperationalAdjustmentRequest =
      user.role === "ti" &&
      isStatusPreservingRequest &&
      STATUS_WITH_OPERATIONAL_ADJUSTMENT.has(statusAtual);
    const isOperationalAdjustmentRequest =
      isAdminOperationalAdjustmentRequest || isTiOperationalAdjustmentRequest;

    let allowed = false;

    if (user.role === "admin") {
      if (isAdminOperationalAdjustmentRequest) {
        allowed = true;
      } else if (statusAtual === "pendente_financeiro") {
        const allowedNextStatuses = UPDATE_STATUS_ALLOWED_NEXT_BY_ROLE.admin ?? [];
        if (!allowedNextStatuses.includes(statusNovo)) {
          throw new Error("Status invalido para aprovacao financeira.");
        }
        allowed = true;
      } else {
        allowed = true;
      }
    } else if (user.role === "lider_setor") {
      if (!user.setorId || solicitacao.setorId !== user.setorId) {
        throw new Error("Voce nao tem permissao para alterar solicitacoes de outro setor.");
      }

      if (statusNovo === "cancelado") {
        if (solicitacao.solicitanteId !== user.id) {
          throw new Error("Voce so pode cancelar solicitacoes criadas por voce.");
        }

        if (!REQUESTER_CANCEL_ALLOWED_CURRENT_STATUSES.includes(statusAtual)) {
          throw new Error("So e possivel cancelar solicitacoes pendentes ou devolvidas.");
        }

        allowed = true;
      }
    } else if (user.role === "user") {
      if (statusNovo !== "cancelado") {
        throw new Error("Voce nao tem permissao para esta acao.");
      }

      if (solicitacao.solicitanteId !== user.id) {
        throw new Error("Voce so pode cancelar solicitacoes criadas por voce.");
      }

      if (!REQUESTER_CANCEL_ALLOWED_CURRENT_STATUSES.includes(statusAtual)) {
        throw new Error("So e possivel cancelar solicitacoes pendentes ou devolvidas.");
      }

      allowed = true;
    } else if (user.role === "diretora_financeiro") {
      const allowedNextStatuses =
        UPDATE_STATUS_ALLOWED_NEXT_BY_ROLE.diretora_financeiro ?? [];

      if (!allowedNextStatuses.includes(statusNovo)) {
        throw new Error("Status invalido para aprovacao financeira.");
      }

      if (statusAtual !== "pendente_financeiro") {
        throw new Error("A solicitacao nao esta pendente de aprovacao financeira.");
      }

      allowed = true;
    } else if (user.role === "diretora_empresa") {
      const allowedNextStatuses =
        UPDATE_STATUS_ALLOWED_NEXT_BY_ROLE.diretora_empresa ?? [];

      if (!allowedNextStatuses.includes(statusNovo)) {
        throw new Error("Status invalido para deliberacao da diretoria.");
      }

      if (statusAtual !== "pendente_diretoria") {
        throw new Error("A solicitacao nao esta pendente de deliberacao da diretoria.");
      }

      if (statusNovo === "aprovado_para_compra") {
        finalStatus = "aprovado_para_compra";
      }

      allowed = true;
    } else if (user.role === "ti") {
      if (isTiOperationalAdjustmentRequest) {
        allowed = true;
      } else {
        const allowedNextStatuses = TI_STATUS_TRANSITIONS[statusAtual] ?? [];
        if (!allowedNextStatuses.includes(statusNovo)) {
          throw new Error("Transicao de status invalida para operacao do TI.");
        }
        allowed = true;
      }
    }

    if (!allowed) {
      throw new Error("Voce nao tem permissao para alterar a solicitacao para este status.");
    }

    if (statusAtual === finalStatus && !isOperationalAdjustmentRequest) {
      throw new Error("Nenhuma transicao de status valida foi informada.");
    }

    const isFinancialTransitionNow = isFinancialTransition(statusAtual, finalStatus);
    const isBoardTransitionNow = isBoardTransition(statusAtual, finalStatus);
    const isTiCompraTransitionNow = isTiCompraTransition(statusAtual, finalStatus);
    const isFinancialApprovalPathNow = isFinancialApprovalPath(finalStatus);

    if (finalStatus === "rejeitado") {
      requireComment(comentario);
    }

    if (isFinancialTransitionNow && isFinancialApprovalPathNow) {
      if (!input.metodoPagamento) {
        throw new Error("Metodo de pagamento e obrigatorio para aprovacao financeira.");
      }

      if (isCardPaymentMethod(input.metodoPagamento) && !input.parcelas) {
        throw new Error("Parcelamento e obrigatorio quando o metodo de pagamento e cartao.");
      }
    }

    if (
      user.role === "ti" &&
      (finalStatus === "devolvido" || finalStatus === "inviavel_operacional")
    ) {
      requireComment(comentario);
    }

    if (isTiCompraTransitionNow) {
      if (!input.dataCompra) {
        throw new Error("Data da compra e obrigatoria ao marcar como comprado.");
      }

      if (!input.canalCompra || input.canalCompra.trim().length < 2) {
        throw new Error("Canal de compra e obrigatorio ao marcar como comprado.");
      }

      if (
        !hasPositiveAmount(input.valorRealCompraUnitario) &&
        !hasPositiveAmount(input.valorRealCompra)
      ) {
        throw new Error(
          "Informe o valor real unitario da compra (ou valor total legado) para concluir."
        );
      }
    }

    let adjustmentChanges: AdjustmentChange[] = [];
    let adjustmentUpdatePayload: AdjustmentUpdatePayload | null = null;

    if (isOperationalAdjustmentRequest) {
      requireComment(comentario);

      const quantidadeAtual = normalizeQuantity(solicitacao.quantidade);
      const quantidadeNova = hasPositiveAmount(input.quantidadeAjustada)
        ? normalizeQuantity(input.quantidadeAjustada)
        : quantidadeAtual;

      const valorEstimadoAtual = roundCurrency(toFiniteNumber(solicitacao.valorEstimado, 0));
      if (
        isAdminOperationalAdjustmentRequest &&
        input.valorEstimado !== undefined &&
        !hasPositiveAmount(input.valorEstimado)
      ) {
        throw new Error("Valor estimado unitario deve ser maior que zero.");
      }
      const valorEstimadoNovo =
        isAdminOperationalAdjustmentRequest && hasPositiveAmount(input.valorEstimado)
          ? roundCurrency(toFiniteNumber(input.valorEstimado, 0))
          : valorEstimadoAtual;

      const valorEstimadoTotalAtual = calculateEstimatedTotal({
        valorEstimadoUnitario: valorEstimadoAtual,
        quantidade: quantidadeAtual,
      });
      const valorEstimadoTotalNovo = calculateEstimatedTotal({
        valorEstimadoUnitario: valorEstimadoNovo,
        quantidade: quantidadeNova,
      });

      const valorRealUnitarioAtual = resolveRealUnitario({
        valorRealCompraUnitario: solicitacao.valorRealCompraUnitario,
        valorRealCompraLegado: solicitacao.valorRealCompra,
        quantidade: quantidadeAtual,
      });
      const valorRealUnitarioInformado = hasPositiveAmount(input.valorRealCompraUnitario)
        ? roundCurrency(toFiniteNumber(input.valorRealCompraUnitario, 0))
        : null;
      const valorRealLegadoInformado = hasPositiveAmount(input.valorRealCompra)
        ? roundCurrency(toFiniteNumber(input.valorRealCompra, 0))
        : null;

      const valorRealUnitarioNovo = valorRealUnitarioInformado ?? valorRealUnitarioAtual;
      const hasRealContext =
        hasPositiveAmount(solicitacao.valorRealCompraUnitario) ||
        hasPositiveAmount(solicitacao.valorRealCompra) ||
        valorRealUnitarioInformado !== null ||
        valorRealLegadoInformado !== null;

      const valorRealTotalAtual = calculateRealTotal({
        valorRealCompraUnitario: valorRealUnitarioAtual,
        valorRealCompraLegado: solicitacao.valorRealCompra,
        quantidade: quantidadeAtual,
      });

      const valorRealTotalNovo = hasRealContext
        ? calculateRealTotal({
            valorRealCompraUnitario: valorRealUnitarioNovo,
            valorRealCompraLegado: valorRealLegadoInformado ?? solicitacao.valorRealCompra,
            quantidade: quantidadeNova,
          })
        : 0;

      if (hasRealContext && valorRealTotalNovo <= 0) {
        throw new Error("Nao foi possivel recalcular o valor real total apos o ajuste.");
      }

      const tituloNovo =
        isAdminOperationalAdjustmentRequest && input.titulo !== undefined
          ? input.titulo.trim()
          : solicitacao.titulo;
      if (!tituloNovo || tituloNovo.length < 3) {
        throw new Error("Titulo invalido para ajuste administrativo.");
      }

      const descricaoNova =
        isAdminOperationalAdjustmentRequest && input.descricao !== undefined
          ? normalizeOptionalString(input.descricao)
          : solicitacao.descricao;

      const metodoPagamentoNovo =
        isAdminOperationalAdjustmentRequest && input.metodoPagamento !== undefined
          ? input.metodoPagamento
          : solicitacao.metodoPagamento;

      let parcelasNova =
        isAdminOperationalAdjustmentRequest && input.parcelas !== undefined
          ? input.parcelas
          : solicitacao.parcelas;
      if (isAdminOperationalAdjustmentRequest) {
        if (isCardPaymentMethod(metodoPagamentoNovo)) {
          if (!parcelasNova || parcelasNova < 1) {
            parcelasNova = 1;
          }
        } else {
          parcelasNova = null;
        }
      }

      const dataCompraNova =
        input.dataCompra !== undefined
          ? input.dataCompra
            ? new Date(input.dataCompra)
            : null
          : solicitacao.dataCompra;
      const fornecedorNovo =
        input.fornecedor !== undefined
          ? normalizeOptionalString(input.fornecedor)
          : solicitacao.fornecedor;
      const canalCompraNovo =
        input.canalCompra !== undefined
          ? normalizeCanalCompra(input.canalCompra)
          : solicitacao.canalCompra;
      const referenciaPedidoNovo =
        input.referenciaPedido !== undefined
          ? referenciaPedido
          : solicitacao.referenciaPedido;
      const observacaoCompraNova =
        input.observacaoCompra !== undefined
          ? observacaoCompra
          : solicitacao.observacaoCompra;
      const linkProdutoNovo =
        isAdminOperationalAdjustmentRequest && input.linkProduto !== undefined
          ? normalizeOptionalUrl(input.linkProduto)
          : solicitacao.linkProduto;

      if (isAdminOperationalAdjustmentRequest) {
        pushChange(adjustmentChanges, "titulo", solicitacao.titulo, tituloNovo);
        pushChange(adjustmentChanges, "descricao", solicitacao.descricao, descricaoNova);
        pushChange(
          adjustmentChanges,
          "valor_estimado_unitario",
          valorEstimadoAtual,
          valorEstimadoNovo
        );
        pushChange(
          adjustmentChanges,
          "valor_estimado_total",
          valorEstimadoTotalAtual,
          valorEstimadoTotalNovo
        );
        pushChange(
          adjustmentChanges,
          "metodo_pagamento",
          solicitacao.metodoPagamento,
          metodoPagamentoNovo
        );
        pushChange(adjustmentChanges, "parcelas", solicitacao.parcelas, parcelasNova);
        pushChange(adjustmentChanges, "link_produto", solicitacao.linkProduto, linkProdutoNovo);
      }

      pushChange(adjustmentChanges, "quantidade", quantidadeAtual, quantidadeNova);
      pushChange(
        adjustmentChanges,
        "valor_real_compra_unitario",
        valorRealUnitarioAtual,
        hasRealContext ? valorRealUnitarioNovo : null
      );
      pushChange(
        adjustmentChanges,
        "valor_real_compra_total",
        valorRealTotalAtual,
        hasRealContext ? valorRealTotalNovo : null
      );
      pushChange(adjustmentChanges, "data_compra", solicitacao.dataCompra, dataCompraNova);
      pushChange(adjustmentChanges, "fornecedor", solicitacao.fornecedor, fornecedorNovo);
      pushChange(adjustmentChanges, "canal_compra", solicitacao.canalCompra, canalCompraNovo);
      pushChange(
        adjustmentChanges,
        "referencia_pedido",
        solicitacao.referenciaPedido,
        referenciaPedidoNovo
      );
      pushChange(
        adjustmentChanges,
        "observacao_compra",
        solicitacao.observacaoCompra,
        observacaoCompraNova
      );

      if (adjustmentChanges.length === 0) {
        throw new Error("Nenhuma alteracao foi informada para ajuste.");
      }

      adjustmentUpdatePayload = {
        titulo: tituloNovo,
        descricao: descricaoNova,
        valorEstimado: valorEstimadoNovo.toString(),
        quantidade: quantidadeNova,
        valorRealCompraUnitario:
          hasRealContext && valorRealUnitarioNovo !== null
            ? valorRealUnitarioNovo.toString()
            : null,
        valorRealCompra:
          hasRealContext && valorRealTotalNovo > 0 ? valorRealTotalNovo.toString() : null,
        metodoPagamento: (metodoPagamentoNovo ?? null) as MetodoPagamento | null,
        formaPagamento: isAdminOperationalAdjustmentRequest
          ? toLegacyFormaPagamento(metodoPagamentoNovo)
          : toLegacyFormaPagamento(solicitacao.metodoPagamento),
        parcelas: parcelasNova ?? null,
        dataCompra: dataCompraNova,
        fornecedor: fornecedorNovo,
        canalCompra: canalCompraNovo,
        referenciaPedido: referenciaPedidoNovo,
        observacaoCompra: observacaoCompraNova,
        linkProduto: linkProdutoNovo,
      };
    }

    await db.transaction().execute(async (trx) => {
      if (isFinancialTransitionNow) {
        const metodoPagamento =
          isFinancialApprovalPathNow ? input.metodoPagamento ?? null : null;
        const formaPagamentoLegada = toLegacyFormaPagamento(metodoPagamento);

        const parcelas =
          isFinancialApprovalPathNow && isCardPaymentMethod(input.metodoPagamento)
            ? input.parcelas ?? 1
            : null;

        await trx
          .updateTable("solicitacoes")
          .set({
            status: finalStatus,
            formaPagamento: formaPagamentoLegada,
            metodoPagamento,
            parcelas,
            financeiroJustificativa: comentario,
            financeiroAprovadoPor: user.id,
            financeiroAprovadoEm: new Date(),
            dataPrevistaPagamento: null,
          })
          .where("id", "=", input.solicitacaoId)
          .execute();
      } else if (isTiCompraTransitionNow) {
        const quantidadeCompra = normalizeQuantity(solicitacao.quantidade);
        const valorRealUnitario = hasPositiveAmount(input.valorRealCompraUnitario)
          ? roundCurrency(toFiniteNumber(input.valorRealCompraUnitario, 0))
          : resolveRealUnitario({
              valorRealCompraLegado: input.valorRealCompra,
              quantidade: quantidadeCompra,
            });
        const valorRealTotal = calculateRealTotal({
          valorRealCompraUnitario: valorRealUnitario,
          valorRealCompraLegado: input.valorRealCompra,
          quantidade: quantidadeCompra,
        });

        await trx
          .updateTable("solicitacoes")
          .set({
            status: finalStatus,
            valorRealCompraUnitario:
              valorRealUnitario !== null ? valorRealUnitario.toString() : null,
            valorRealCompra: valorRealTotal > 0 ? valorRealTotal.toString() : null,
            dataCompra: input.dataCompra ? new Date(input.dataCompra) : null,
            fornecedor: normalizeOptionalString(input.fornecedor),
            canalCompra: normalizeCanalCompra(input.canalCompra),
            referenciaPedido,
            observacaoCompra,
          })
          .where("id", "=", input.solicitacaoId)
          .execute();
      } else if (isOperationalAdjustmentRequest && adjustmentUpdatePayload) {
        const setPayload: Record<string, unknown> = {
          quantidade: adjustmentUpdatePayload.quantidade,
          valorRealCompraUnitario: adjustmentUpdatePayload.valorRealCompraUnitario,
          valorRealCompra: adjustmentUpdatePayload.valorRealCompra,
          dataCompra: adjustmentUpdatePayload.dataCompra,
          fornecedor: adjustmentUpdatePayload.fornecedor,
          canalCompra: adjustmentUpdatePayload.canalCompra,
          referenciaPedido: adjustmentUpdatePayload.referenciaPedido,
          observacaoCompra: adjustmentUpdatePayload.observacaoCompra,
        };

        if (isAdminOperationalAdjustmentRequest) {
          setPayload.titulo = adjustmentUpdatePayload.titulo;
          setPayload.descricao = adjustmentUpdatePayload.descricao;
          setPayload.valorEstimado = adjustmentUpdatePayload.valorEstimado;
          setPayload.metodoPagamento = adjustmentUpdatePayload.metodoPagamento;
          setPayload.formaPagamento = adjustmentUpdatePayload.formaPagamento;
          setPayload.parcelas = adjustmentUpdatePayload.parcelas;
          setPayload.linkProduto = adjustmentUpdatePayload.linkProduto;
        }

        await trx
          .updateTable("solicitacoes")
          .set(setPayload as any)
          .where("id", "=", input.solicitacaoId)
          .execute();

        await trx
          .insertInto("solicitacoesAjustesOperacionais")
          .values(
            adjustmentChanges.map((change) => ({
              solicitacaoId: input.solicitacaoId,
              usuarioId: user.id,
              campo: change.campo,
              valorAnterior: change.valorAnterior,
              valorNovo: change.valorNovo,
              justificativa: comentario ?? "Ajuste operacional",
            }))
          )
          .execute();
      } else {
        await trx
          .updateTable("solicitacoes")
          .set({
            status: finalStatus,
          })
          .where("id", "=", input.solicitacaoId)
          .execute();
      }

      await trx
        .insertInto("historicoStatus")
        .values({
          solicitacaoId: input.solicitacaoId,
          statusAnterior: statusAtual,
          statusNovo: finalStatus,
          usuarioId: user.id,
          comentario,
        })
        .execute();

      if (
        (user.role === "diretora_financeiro" ||
          user.role === "diretora_empresa" ||
          user.role === "admin") &&
        (isFinancialTransitionNow || isBoardTransitionNow)
      ) {
        await trx
          .insertInto("aprovacoes")
          .values({
            solicitacaoId: input.solicitacaoId,
            aprovadorId: user.id,
            status: finalStatus,
            comentario,
          })
          .execute();
      }
    });

    if (statusAtual !== finalStatus) {
      setImmediate(() => {
        void notifySolicitacaoStatusChange({
          solicitacaoId: input.solicitacaoId,
          statusAnterior: statusAtual,
          statusNovo: finalStatus,
          usuarioId: user.id,
          comentario,
          titulo: solicitacao.titulo,
        }).catch((notificationError) => {
          console.error("SMS notification error:", notificationError);
        });

        void notifySolicitacaoStatusEmailChange({
          solicitacaoId: input.solicitacaoId,
          statusAnterior: statusAtual,
          statusNovo: finalStatus,
          usuarioId: user.id,
          comentario,
        }).catch((notificationError) => {
          console.error("Email notification error (update-status):", notificationError);
        });
      });
    }

    return new Response(
      superjson.stringify({ success: true } satisfies OutputType),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(superjson.stringify({ error: message }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
