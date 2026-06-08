import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { schema } from "./executivo-pdf_GET.schema";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import {
  formatCanalCompraLabel,
  formatEmpresaLabel,
  formatMetodoPagamentoLabel,
  getStatsVisibilityFilters,
  SOLICITACAO_STATUS_LABELS,
  type SolicitacaoVisibilityFilters,
} from "../../helpers/solicitacoesDomain";
import type { Empresa, SolicitacaoStatus } from "../../helpers/schema";
import {
  estimatedTotalSql,
  quantitySql,
  realTotalHybridSql,
} from "../../helpers/monetarySql";

const EXECUTIVE_COMPLETED_STATUSES: SolicitacaoStatus[] = ["comprado", "concluido"];
const PAGE_SIZE: [number, number] = [842, 595];
const MARGIN_X = 28;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 32;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN_X * 2;
const FOOTER_HEIGHT = 22;

const COLORS = {
  text: rgb(0.13, 0.15, 0.2),
  muted: rgb(0.43, 0.47, 0.54),
  line: rgb(0.83, 0.85, 0.89),
  softLine: rgb(0.9, 0.92, 0.95),
  panel: rgb(0.968, 0.972, 0.978),
  card: rgb(0.986, 0.989, 0.993),
  accent: rgb(0.47, 0.34, 0.12),
  accentSoft: rgb(0.95, 0.92, 0.87),
  heading: rgb(0.1, 0.12, 0.16),
  success: rgb(0.09, 0.42, 0.25),
  warning: rgb(0.71, 0.47, 0.1),
};

type ExecutivePeriod = {
  start: Date;
  endExclusive: Date;
  startDate: string;
  endDate: string;
};

type AnalyticsRow = {
  label: string;
  total: number;
  quantity: number;
};

type DetailRow = {
  solicitacaoId: number;
  dataCompra: Date | string | null;
  empresa: Empresa;
  titulo: string;
  setorNome: string;
  quantidade: number;
  valorEstimadoUnitario: number;
  valorRealUnitario: number | null;
  valorRealTotal: number;
  parcelas: number | null;
  solicitanteNome: string;
  aprovadorNome: string | null;
  metodoPagamento: string | null;
  canalCompra: string | null;
  status: string;
};

type DrawTextOptions = {
  size?: number;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  align?: "left" | "right" | "center";
  maxWidth?: number;
  lineHeight?: number;
};

type DetailColumn = {
  label: string;
  width: number;
  key: string;
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayUtc(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function getExecutivePeriod(input: { startDate?: string; endDate?: string }): ExecutivePeriod {
  if (input.startDate && input.endDate) {
    const start = startOfDayUtc(new Date(`${input.startDate}T00:00:00.000Z`));
    const endInclusive = startOfDayUtc(new Date(`${input.endDate}T00:00:00.000Z`));

    return {
      start,
      endExclusive: addDaysUtc(endInclusive, 1),
      startDate: toIsoDate(start),
      endDate: toIsoDate(endInclusive),
    };
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const endInclusive = addDaysUtc(endExclusive, -1);

  return {
    start,
    endExclusive,
    startDate: toIsoDate(start),
    endDate: toIsoDate(endInclusive),
  };
}

function fixPresentationText(text: string) {
  if (!text || !/[\u00C3\u00C2]/.test(text)) {
    return text;
  }

  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR").format(Number(value ?? 0));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}x`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatMetodoPagamento(value: string | null | undefined) {
  return fixPresentationText(formatMetodoPagamentoLabel(value));
}

function formatCanalCompra(value: string | null | undefined) {
  return fixPresentationText(formatCanalCompraLabel(value));
}

function formatStatus(value: string) {
  return fixPresentationText(
    SOLICITACAO_STATUS_LABELS[value as SolicitacaoStatus] ?? value
  );
}

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3))}...`;
}

function safePercent(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return (part / total) * 100;
}

function applyVisibilityFilters<TQuery>(query: TQuery, filters: SolicitacaoVisibilityFilters) {
  let next = query as any;

  if (typeof filters.solicitanteId === "number") {
    next = next.where("solicitacoes.solicitanteId", "=", filters.solicitanteId);
  }

  if (typeof filters.setorId === "number") {
    next = next.where("solicitacoes.setorId", "=", filters.setorId);
  }

  if (filters.allowedStatuses?.length === 1) {
    next = next.where("solicitacoes.status", "=", filters.allowedStatuses[0]);
  } else if (filters.allowedStatuses?.length) {
    next = next.where("solicitacoes.status", "in", filters.allowedStatuses);
  }

  if (typeof filters.minValorEstimadoExclusive === "number") {
    next = next.where(
      estimatedTotalSql("solicitacoes"),
      ">",
      filters.minValorEstimadoExclusive
    );
  }

  return next as TQuery;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const normalized = (text || "-").replace(/\s+/g, " ").trim() || "-";
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > 0) {
      let sliceLength = remaining.length;
      while (
        sliceLength > 1 &&
        font.widthOfTextAtSize(`${remaining.slice(0, sliceLength)}-`, size) > maxWidth
      ) {
        sliceLength -= 1;
      }

      if (sliceLength <= 1) {
        lines.push(remaining);
        remaining = "";
      } else {
        lines.push(`${remaining.slice(0, sliceLength)}-`);
        remaining = remaining.slice(sliceLength);
      }
    }

    current = "";
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : ["-"];
}

function getEstimateVsActualInsight(totalEstimado: number, totalRealizado: number) {
  if (totalEstimado <= 0) {
    return {
      headline: "Sem base estimada",
      support: "Diferença entre estimado e realizado indisponível.",
    };
  }

  const percentual = safePercent(totalRealizado, totalEstimado);
  const ratio = totalRealizado / totalEstimado;
  const diferenca = totalRealizado - totalEstimado;

  if (ratio >= 10) {
    return {
      headline: `${formatRatio(ratio)} do estimado`,
      support:
        diferenca > 0
          ? `Realizado acima do estimado em ${formatCurrency(diferenca)} (${formatPercent(percentual)}).`
          : `Diferença entre estimado e realizado: ${formatCurrency(diferenca)}.`,
    };
  }

  return {
    headline: formatPercent(percentual),
    support:
      diferenca > 0
        ? `Realizado acima do estimado em ${formatCurrency(diferenca)}.`
        : diferenca < 0
          ? `Diferença entre estimado e realizado: ${formatCurrency(diferenca)}.`
          : "Estimado e realizado estão alinhados no período.",
  };
}

function getDetailColumns(): DetailColumn[] {
  return [
    { label: "#", width: 22, key: "num" },
    { label: "Pedido", width: 44, key: "pedido" },
    { label: "Data", width: 50, key: "data" },
    { label: "Empresa", width: 68, key: "empresa" },
    { label: "Item", width: 148, key: "item" },
    { label: "Setor", width: 68, key: "setor" },
    { label: "Solicit.", width: 68, key: "solicitante" },
    { label: "Qtd", width: 28, key: "qtd" },
    { label: "V.Unit.", width: 58, key: "vunit" },
    { label: "V.Real", width: 62, key: "vreal" },
    { label: "Parcelas", width: 42, key: "parcelas" },
    { label: "Método", width: 68, key: "metodo" },
    { label: "Canal", width: 60, key: "canal" },
  ];
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const url = new URL(request.url);

    const parsedInput = schema.safeParse({
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
      setorId: url.searchParams.get("setorId")
        ? Number(url.searchParams.get("setorId"))
        : undefined,
      empresa: url.searchParams.get("empresa") ?? undefined,
      metodoPagamento: url.searchParams.get("metodoPagamento") ?? undefined,
      canalCompra: url.searchParams.get("canalCompra") ?? undefined,
    });

    if (!parsedInput.success) {
      return new Response("Parâmetros inválidos para geração do relatório.", { status: 400 });
    }

    const filters = parsedInput.data;
    const executivePeriod = getExecutivePeriod(filters);
    const visibilityFilters = getStatsVisibilityFilters(user);

    if (visibilityFilters.isEmptyResult) {
      return new Response("Sem dados disponíveis para o perfil atual.", { status: 403 });
    }

    let baseCompletedQuery = applyVisibilityFilters(
      db.selectFrom("solicitacoes"),
      visibilityFilters
    )
      .where("solicitacoes.status", "in", EXECUTIVE_COMPLETED_STATUSES)
      .where("solicitacoes.dataCompra", ">=", executivePeriod.start)
      .where("solicitacoes.dataCompra", "<", executivePeriod.endExclusive)
      .where((eb) =>
        eb.or([
          eb("solicitacoes.valorRealCompra", "is not", null),
          eb("solicitacoes.valorRealCompraUnitario", "is not", null),
        ])
      );

    if (typeof filters.setorId === "number") {
      baseCompletedQuery = baseCompletedQuery.where("solicitacoes.setorId", "=", filters.setorId);
    }

    if (filters.empresa) {
      baseCompletedQuery = baseCompletedQuery.where("solicitacoes.empresa", "=", filters.empresa);
    }

    if (filters.metodoPagamento) {
      baseCompletedQuery = baseCompletedQuery.where(
        "solicitacoes.metodoPagamento",
        "=",
        filters.metodoPagamento
      );
    }

    if (filters.canalCompra) {
      baseCompletedQuery = baseCompletedQuery.where(
        db.fn("lower", [db.dynamic.ref("solicitacoes.canalCompra")]),
        "=",
        filters.canalCompra.toLowerCase()
      );
    }

    const [
      executiveTotals,
      gastosPorEmpresaRows,
      gastosPorSetorRows,
      gastosPorMetodoRows,
      gastosPorCanalRows,
      gastosPorStatusRows,
      detalhamentoRows,
      setor,
    ] = await Promise.all([
      baseCompletedQuery
        .select([
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(estimatedTotalSql("solicitacoes")), eb.val(0))
              .as("totalEstimado"),
          (eb) => eb.fn.count<number>("solicitacoes.id").as("comprasConcluidas"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("totalItensComprados"),
        ])
        .executeTakeFirst(),
      baseCompletedQuery
        .select([
          "solicitacoes.empresa as empresa",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy("solicitacoes.empresa")
        .execute(),
      baseCompletedQuery
        .innerJoin("setores", "solicitacoes.setorId", "setores.id")
        .select([
          "setores.nome as setorNome",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy(["setores.id", "setores.nome"])
        .execute(),
      baseCompletedQuery
        .select([
          "solicitacoes.metodoPagamento as metodoPagamento",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy("solicitacoes.metodoPagamento")
        .execute(),
      baseCompletedQuery
        .select([
          "solicitacoes.canalCompra as canalCompra",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy("solicitacoes.canalCompra")
        .execute(),
      baseCompletedQuery
        .select([
          "solicitacoes.status as status",
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(realTotalHybridSql("solicitacoes")), eb.val(0))
              .as("totalRealizado"),
          (eb) =>
            eb.fn
              .coalesce(eb.fn.sum(quantitySql("solicitacoes")), eb.val(0))
              .as("quantidade"),
        ])
        .groupBy("solicitacoes.status")
        .execute(),
      baseCompletedQuery
        .innerJoin("setores", "solicitacoes.setorId", "setores.id")
        .innerJoin("users", "solicitacoes.solicitanteId", "users.id")
        .select([
          "solicitacoes.id as solicitacaoId",
          "solicitacoes.dataCompra",
          "solicitacoes.empresa",
          "solicitacoes.titulo",
          "solicitacoes.financeiroAprovadoPor",
          "solicitacoes.quantidade as quantidade",
          "solicitacoes.valorEstimado as valorEstimadoUnitario",
          "solicitacoes.valorRealCompraUnitario as valorRealUnitario",
          "solicitacoes.parcelas as parcelas",
          "setores.nome as setorNome",
          "users.displayName as solicitanteNome",
          realTotalHybridSql("solicitacoes").as("valorRealTotal"),
          "solicitacoes.metodoPagamento",
          "solicitacoes.canalCompra",
          "solicitacoes.status",
        ])
        .orderBy("solicitacoes.dataCompra", "desc")
        .execute(),
      filters.setorId
        ? db
            .selectFrom("setores")
            .select(["id", "nome"])
            .where("id", "=", filters.setorId)
            .executeTakeFirst()
        : Promise.resolve(null),
    ]);

    const totalRealizado = Number(executiveTotals?.totalRealizado ?? 0);
    const totalEstimado = Number(executiveTotals?.totalEstimado ?? 0);
    const totalComprasConcluidas = Number(executiveTotals?.comprasConcluidas ?? 0);
    const totalItensComprados = Number(executiveTotals?.totalItensComprados ?? 0);
    const ticketMedio = totalComprasConcluidas > 0 ? totalRealizado / totalComprasConcluidas : 0;
    const estimadoVsRealizadoPercentual =
      totalEstimado > 0 ? safePercent(totalRealizado, totalEstimado) : null;
    const diferencaEstimadoRealizado = totalRealizado - totalEstimado;
    const issuedAt = new Date();
    const estimateVsActualInsight = getEstimateVsActualInsight(totalEstimado, totalRealizado);

    const gastosPorEmpresa: AnalyticsRow[] = gastosPorEmpresaRows
      .map((row) => ({
        label: formatEmpresaLabel(row.empresa),
        total: Number(row.totalRealizado ?? 0),
        quantity: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const gastosPorSetor: AnalyticsRow[] = gastosPorSetorRows
      .map((row) => ({
        label: row.setorNome,
        total: Number(row.totalRealizado ?? 0),
        quantity: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const gastosPorMetodoPagamento: AnalyticsRow[] = gastosPorMetodoRows
      .map((row) => ({
        label: formatMetodoPagamento(row.metodoPagamento),
        total: Number(row.totalRealizado ?? 0),
        quantity: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const gastosPorCanal: AnalyticsRow[] = gastosPorCanalRows
      .map((row) => ({
        label: formatCanalCompra(row.canalCompra),
        total: Number(row.totalRealizado ?? 0),
        quantity: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const gastosPorStatus: AnalyticsRow[] = gastosPorStatusRows
      .map((row) => ({
        label: formatStatus(row.status),
        total: Number(row.totalRealizado ?? 0),
        quantity: Number(row.quantidade ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    const aprovadorIds = Array.from(
      new Set(
        detalhamentoRows
          .map((row) => row.financeiroAprovadoPor)
          .filter((id): id is number => id !== null && id !== undefined)
      )
    );
    const aprovadoresMap =
      aprovadorIds.length > 0
        ? await db
            .selectFrom("users")
            .select(["id", "displayName"])
            .where("id", "in", aprovadorIds)
            .execute()
            .then((rows) => new Map(rows.map((row) => [row.id, row.displayName])))
        : new Map<number, string>();

    const detalhamento: DetailRow[] = detalhamentoRows.map((row) => ({
      solicitacaoId: Number(row.solicitacaoId),
      dataCompra: row.dataCompra,
      empresa: row.empresa,
      titulo: row.titulo,
      setorNome: row.setorNome,
      quantidade: Number(row.quantidade ?? 0),
      valorEstimadoUnitario: Number(row.valorEstimadoUnitario ?? 0),
      valorRealUnitario:
        row.valorRealUnitario === null || row.valorRealUnitario === undefined
          ? null
          : Number(row.valorRealUnitario),
      valorRealTotal: Number(row.valorRealTotal ?? 0),
      parcelas: row.parcelas === null || row.parcelas === undefined ? null : Number(row.parcelas),
      solicitanteNome: row.solicitanteNome,
      aprovadorNome: aprovadoresMap.get(row.financeiroAprovadoPor ?? -1) ?? null,
      metodoPagamento: row.metodoPagamento,
      canalCompra: row.canalCompra,
      status: row.status,
    })).sort((a, b) => {
      const empresaCompare = formatEmpresaLabel(a.empresa).localeCompare(formatEmpresaLabel(b.empresa));
      if (empresaCompare !== 0) return empresaCompare;
      return new Date(b.dataCompra ?? 0).getTime() - new Date(a.dataCompra ?? 0).getTime();
    });

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages: PDFPage[] = [];
    let page = pdfDoc.addPage(PAGE_SIZE);
    pages.push(page);
    let cursorY = PAGE_SIZE[1] - MARGIN_TOP;

    const addPage = () => {
      page = pdfDoc.addPage(PAGE_SIZE);
      pages.push(page);
      cursorY = PAGE_SIZE[1] - MARGIN_TOP;
    };

    const availableBottom = MARGIN_BOTTOM + FOOTER_HEIGHT;

    const ensureSpace = (requiredHeight: number) => {
      if (cursorY - requiredHeight >= availableBottom) {
        return;
      }
      addPage();
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      options?: DrawTextOptions
    ) => {
      const size = options?.size ?? 10;
      const font = options?.bold ? fontBold : fontRegular;
      const color = options?.color ?? COLORS.text;
      const width = font.widthOfTextAtSize(text, size);
      let finalX = x;

      if (options?.align === "right") {
        finalX = x - width;
      } else if (options?.align === "center" && options.maxWidth) {
        finalX = x + (options.maxWidth - width) / 2;
      }

      page.drawText(text, {
        x: finalX,
        y,
        size,
        font,
        color,
      });
    };

    const drawWrappedText = (
      text: string,
      x: number,
      y: number,
      width: number,
      options?: DrawTextOptions & { maxLines?: number }
    ) => {
      const size = options?.size ?? 10;
      const font = options?.bold ? fontBold : fontRegular;
      const lineHeight = options?.lineHeight ?? size + 2;
      const lines = wrapText(font, text, size, width);
      const limitedLines =
        typeof options?.maxLines === "number" ? lines.slice(0, options.maxLines) : lines;

      if (
        typeof options?.maxLines === "number" &&
        lines.length > options.maxLines &&
        limitedLines.length > 0
      ) {
        limitedLines[limitedLines.length - 1] = truncate(
          limitedLines[limitedLines.length - 1],
          Math.max(8, limitedLines[limitedLines.length - 1].length - 2)
        );
      }

      for (let i = 0; i < limitedLines.length; i += 1) {
        drawText(limitedLines[i], x, y - i * lineHeight, options);
      }

      return limitedLines.length * lineHeight;
    };

    const drawRule = (y: number, color = COLORS.line) => {
      page.drawLine({
        start: { x: MARGIN_X, y },
        end: { x: PAGE_SIZE[0] - MARGIN_X, y },
        thickness: 0.75,
        color,
      });
    };

    const drawSectionHeader = (title: string, subtitle?: string) => {
      ensureSpace(subtitle ? 32 : 20);
      drawText(title, MARGIN_X, cursorY, {
        size: 13,
        bold: true,
        color: COLORS.heading,
      });
      cursorY -= 15;
      if (subtitle) {
        drawText(subtitle, MARGIN_X, cursorY, {
          size: 8.5,
          color: COLORS.muted,
        });
        cursorY -= 11;
      }
      drawRule(cursorY, COLORS.softLine);
      cursorY -= 8;
    };

    const drawHeaderBlock = () => {
      const panelHeight = 86;
      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - panelHeight,
        width: CONTENT_WIDTH,
        height: panelHeight,
        color: COLORS.panel,
        borderColor: COLORS.line,
        borderWidth: 0.8,
      });

      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - 8,
        width: CONTENT_WIDTH,
        height: 8,
        color: COLORS.accent,
      });

      drawText("Portal Interno de Requisição de Compras", MARGIN_X + 16, cursorY - 24, {
        size: 10,
        bold: true,
        color: COLORS.accent,
      });
      drawText("Relatório Executivo de Compras - PDF v3.0", MARGIN_X + 16, cursorY - 46, {
        size: 20,
        bold: true,
        color: COLORS.heading,
      });
      drawText(
        "Visão executiva das compras concluídas com valor real registrado no período.",
        MARGIN_X + 16,
        cursorY - 61,
        {
          size: 8.8,
          color: COLORS.muted,
        }
      );

      const rightX = PAGE_SIZE[0] - MARGIN_X - 16;
      drawText(
        `Período analisado: ${executivePeriod.startDate} a ${executivePeriod.endDate}`,
        rightX,
        cursorY - 24,
        {
          size: 9,
          align: "right",
          color: COLORS.text,
        }
      );
      drawText(`Emitido em: ${formatDateTime(issuedAt)}`, rightX, cursorY - 38, {
        size: 9,
        align: "right",
        color: COLORS.text,
      });
      drawText(`Usuário emissor: ${user.displayName}`, rightX, cursorY - 52, {
        size: 9,
        align: "right",
        color: COLORS.text,
      });
      drawText(`${user.email}`, rightX, cursorY - 66, {
        size: 8,
        align: "right",
        color: COLORS.muted,
      });

      cursorY -= panelHeight + 14;
    };

    const drawMetricCards = () => {
      const cards = [
        {
          label: "Total gasto no período",
          value: formatCurrency(totalRealizado),
          tone: COLORS.heading,
          support: "Consolidado das compras concluídas no recorte.",
        },
        {
          label: "Compras concluídas",
          value: formatNumber(totalComprasConcluidas),
          tone: COLORS.heading,
          support: "Solicitações com fechamento operacional no período.",
        },
        {
          label: "Itens comprados",
          value: formatNumber(totalItensComprados),
          tone: COLORS.heading,
          support: "Quantidade total registrada nas compras concluídas.",
        },
        {
          label: "Ticket médio",
          value: formatCurrency(ticketMedio),
          tone: COLORS.heading,
          support: "Média de gasto por compra concluída.",
        },
        {
          label: "Estimado x Realizado",
          value: estimateVsActualInsight.headline,
          tone: COLORS.accent,
          support: estimateVsActualInsight.support,
        },
        {
          label: "Estimado",
          value: formatCurrency(totalEstimado),
          tone: COLORS.heading,
          support: "Soma do valor estimado das compras concluídas.",
        },
        {
          label: "Realizado",
          value: formatCurrency(totalRealizado),
          tone: COLORS.heading,
          support: estimadoVsRealizadoPercentual === null
            ? "Sem base percentual para comparação."
            : `Equivale a ${formatPercent(estimadoVsRealizadoPercentual)} do estimado.`,
        },
        {
          label: "Diferença",
          value: formatCurrency(diferencaEstimadoRealizado),
          tone:
            diferencaEstimadoRealizado > 0
              ? COLORS.warning
              : diferencaEstimadoRealizado < 0
                ? COLORS.success
                : COLORS.heading,
          support:
            diferencaEstimadoRealizado > 0
              ? "Realizado acima do estimado."
              : diferencaEstimadoRealizado < 0
                ? "Realizado abaixo do estimado."
                : "Sem diferença entre estimado e realizado.",
        },
      ];

      const gap = 10;
      const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
      const cardHeight = 64;

      ensureSpace(cardHeight * 2 + gap + 6);

      for (let i = 0; i < cards.length; i += 1) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = MARGIN_X + col * (cardWidth + gap);
        const y = cursorY - row * (cardHeight + gap);

        page.drawRectangle({
          x,
          y: y - cardHeight,
          width: cardWidth,
          height: cardHeight,
          color: COLORS.card,
          borderColor: COLORS.line,
          borderWidth: 0.8,
        });

        drawText(cards[i].label, x + 10, y - 15, {
          size: 7.8,
          color: COLORS.muted,
          bold: true,
        });
        drawText(cards[i].value, x + 10, y - 34, {
          size: 13.5,
          bold: true,
          color: cards[i].tone,
        });
        drawWrappedText(cards[i].support, x + 10, y - 47, cardWidth - 20, {
          size: 7.5,
          color: COLORS.muted,
          lineHeight: 8.5,
          maxLines: 2,
        });
      }

      cursorY -= cardHeight * 2 + gap + 10;
    };

    const drawCompactFiltersTable = () => {
      const rows = [
        ["Período", `${executivePeriod.startDate} a ${executivePeriod.endDate}`],
        ["Empresa", filters.empresa ? formatEmpresaLabel(filters.empresa) : "Todas"],
        ["Setor", setor?.nome ?? "Todos"],
        ["Método de pagamento", formatMetodoPagamento(filters.metodoPagamento ?? null)],
        ["Canal/local de compra", formatCanalCompra(filters.canalCompra ?? null)],
        ["Recorte base", "Compras concluídas com valor real no período"],
      ];

      const tableHeight = rows.length * 19 + 24;
      ensureSpace(tableHeight);

      const labelWidth = 162;
      const rowHeight = 19;
      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - tableHeight,
        width: CONTENT_WIDTH,
        height: tableHeight,
        color: COLORS.card,
        borderColor: COLORS.line,
        borderWidth: 0.8,
      });

      drawText("Filtros aplicados", MARGIN_X + 12, cursorY - 15, {
        size: 10.5,
        bold: true,
        color: COLORS.heading,
      });

      let rowY = cursorY - 29;
      for (let i = 0; i < rows.length; i += 1) {
        if (i > 0) {
          page.drawLine({
            start: { x: MARGIN_X + 12, y: rowY + 5 },
            end: { x: PAGE_SIZE[0] - MARGIN_X - 12, y: rowY + 5 },
            thickness: 0.55,
            color: COLORS.softLine,
          });
        }

        drawText(rows[i][0], MARGIN_X + 12, rowY - 7, {
          size: 8.3,
          bold: true,
          color: COLORS.muted,
        });
        drawText(rows[i][1], MARGIN_X + 12 + labelWidth, rowY - 7, {
          size: 8.8,
          color: COLORS.text,
        });
        rowY -= rowHeight;
      }

      cursorY -= tableHeight + 10;
    };

    const drawAnalyticsTable = (title: string, rows: AnalyticsRow[]) => {
      const headerHeight = 22;
      const rowHeight = 16;
      const minHeight = headerHeight + Math.max(1, rows.length) * rowHeight + 10;
      ensureSpace(minHeight);

      drawText(title, MARGIN_X, cursorY, {
        size: 10.8,
        bold: true,
        color: COLORS.heading,
      });
      cursorY -= 12;

      const col1 = 340;
      const col2 = 105;
      const col3 = 85;
      const col4 = 86;
      const totalHeight = headerHeight + Math.max(1, rows.length) * rowHeight + 6;

      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - totalHeight,
        width: CONTENT_WIDTH,
        height: totalHeight,
        color: COLORS.card,
        borderColor: COLORS.line,
        borderWidth: 0.8,
      });

      const headY = cursorY - 14;
      drawText("Descrição", MARGIN_X + 10, headY, {
        size: 8.3,
        bold: true,
        color: COLORS.muted,
      });
      drawText("Valor total", MARGIN_X + col1 + col2 - 10, headY, {
        size: 8.3,
        bold: true,
        color: COLORS.muted,
        align: "right",
      });
      drawText("Quantidade", MARGIN_X + col1 + col2 + col3 - 10, headY, {
        size: 8.3,
        bold: true,
        color: COLORS.muted,
        align: "right",
      });
      drawText("% do total", MARGIN_X + col1 + col2 + col3 + col4 - 10, headY, {
        size: 8.3,
        bold: true,
        color: COLORS.muted,
        align: "right",
      });

      let rowY = cursorY - headerHeight;
      if (rows.length === 0) {
        drawText("Nenhum dado disponível para este bloco.", MARGIN_X + 10, rowY - 2, {
          size: 8.8,
          color: COLORS.muted,
        });
        cursorY -= totalHeight + 8;
        return;
      }

      for (let i = 0; i < rows.length; i += 1) {
        const item = rows[i];
        if (i > 0) {
          page.drawLine({
            start: { x: MARGIN_X + 10, y: rowY + 3 },
            end: { x: PAGE_SIZE[0] - MARGIN_X - 10, y: rowY + 3 },
            thickness: 0.45,
            color: COLORS.softLine,
          });
        }

        drawText(truncate(fixPresentationText(item.label), 64), MARGIN_X + 10, rowY - 5, {
          size: 8.5,
          color: COLORS.text,
        });
        drawText(formatCurrency(item.total), MARGIN_X + col1 + col2 - 10, rowY - 5, {
          size: 8.5,
          color: COLORS.text,
          align: "right",
        });
        drawText(formatNumber(item.quantity), MARGIN_X + col1 + col2 + col3 - 10, rowY - 5, {
          size: 8.5,
          color: COLORS.text,
          align: "right",
        });
        drawText(
          formatPercent(safePercent(item.total, totalRealizado)),
          MARGIN_X + col1 + col2 + col3 + col4 - 10,
          rowY - 5,
          {
            size: 8.5,
            color: COLORS.text,
            align: "right",
          }
        );
        rowY -= rowHeight;
      }

      cursorY -= totalHeight + 8;
    };

    const drawDetailTable = () => {
      const columns = getDetailColumns();
      const columnWidth = (key: string) =>
        columns.find((column) => column.key === key)?.width ?? 0;
      const columnX = (key: string) => {
        let x = MARGIN_X;
        for (const column of columns) {
          if (column.key === key) return x;
          x += column.width;
        }
        return x;
      };
      const isCardMethod = (metodoPagamento: string | null) =>
        metodoPagamento === "cartao" || metodoPagamento?.startsWith("cartao_") === true;
      const formatParcelas = (row: DetailRow) => {
        if (!isCardMethod(row.metodoPagamento) || !row.parcelas || row.parcelas <= 1) {
          return "1x";
        }
        return `${row.parcelas}x`;
      };

      const getRowHeight = (row: DetailRow) => {
        const itemLines = wrapText(
          fontRegular,
          fixPresentationText(row.titulo),
          8.4,
          columnWidth("item") - 6
        ).slice(0, 4);
        const empresaLines = wrapText(
          fontRegular,
          fixPresentationText(formatEmpresaLabel(row.empresa)),
          8.2,
          columnWidth("empresa") - 6
        ).slice(0, 2);
        const setorLines = wrapText(
          fontRegular,
          fixPresentationText(row.setorNome),
          8.2,
          columnWidth("setor") - 6
        ).slice(0, 2);
        const solicitanteLines = wrapText(
          fontRegular,
          fixPresentationText(row.solicitanteNome),
          8.2,
          columnWidth("solicitante") - 6
        ).slice(0, 2);
        const metodoLines = wrapText(
          fontRegular,
          formatMetodoPagamento(row.metodoPagamento),
          8.2,
          columnWidth("metodo") - 6
        ).slice(0, 2);
        const canalLines = wrapText(
          fontRegular,
          formatCanalCompra(row.canalCompra),
          8.2,
          columnWidth("canal") - 6
        ).slice(0, 2);

        const maxLines = Math.max(
          1,
          itemLines.length,
          empresaLines.length,
          setorLines.length,
          solicitanteLines.length,
          metodoLines.length,
          canalLines.length
        );

        return Math.max(20, maxLines * 9 + 9);
      };

      const drawHeader = () => {
        page.drawRectangle({
          x: MARGIN_X,
          y: cursorY - 22,
          width: CONTENT_WIDTH,
          height: 22,
          color: COLORS.accentSoft,
          borderColor: COLORS.line,
          borderWidth: 0.6,
        });

        let x = MARGIN_X;
        for (const col of columns) {
          drawText(col.label, x + 3, cursorY - 14, {
            size: 7.9,
            bold: true,
            color: COLORS.accent,
          });
          x += col.width;
        }
        cursorY -= 26;
      };

      const drawContinuationLabel = () => {
        drawText("Detalhamento das compras (continuação)", MARGIN_X, cursorY, {
          size: 10.2,
          bold: true,
          color: COLORS.heading,
        });
        cursorY -= 12;
      };

      const drawSubtotalRow = (label: string, total: number, bold = true) => {
        const rowHeight = 16;

        if (cursorY - rowHeight < availableBottom) {
          addPage();
          drawContinuationLabel();
          drawHeader();
        }

        page.drawRectangle({
          x: MARGIN_X,
          y: cursorY - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: COLORS.accentSoft,
          borderColor: COLORS.line,
          borderWidth: 0.5,
        });

        drawText(label, MARGIN_X + 4, cursorY - 11, {
          size: 8.2,
          bold,
          color: COLORS.accent,
        });
        drawText(formatCurrency(total), columnX("vreal") + columnWidth("vreal") - 3, cursorY - 11, {
          size: 8.2,
          bold,
          color: COLORS.accent,
          align: "right",
        });

        cursorY -= rowHeight + 4;
      };

      const firstRowsHeight = detalhamento
        .slice(0, 2)
        .reduce((sum, row) => sum + getRowHeight(row) + 4, 0);
      const introHeight =
        34 +
        26 +
        (detalhamento.length === 0 ? 34 : firstRowsHeight || 30);

      if (cursorY - introHeight < availableBottom) {
        addPage();
      }

      drawSectionHeader(
        "Detalhamento das compras",
        "Tabela executiva com os atributos operacionais das compras concluídas no período."
      );
      drawHeader();

      if (detalhamento.length === 0) {
        ensureSpace(32);
        page.drawRectangle({
          x: MARGIN_X,
          y: cursorY - 28,
          width: CONTENT_WIDTH,
          height: 28,
          color: COLORS.card,
          borderColor: COLORS.line,
          borderWidth: 0.6,
        });
        drawText(
          "Nenhuma compra encontrada para os filtros selecionados.",
          MARGIN_X + 10,
          cursorY - 17,
          {
            size: 8.8,
            color: COLORS.muted,
          }
        );
        cursorY -= 34;
        return;
      }

      for (let rowIndex = 0; rowIndex < detalhamento.length; rowIndex += 1) {
        const row = detalhamento[rowIndex];
        const empresaLabel = fixPresentationText(formatEmpresaLabel(row.empresa));
        const previousRow = detalhamento[rowIndex - 1];
        const previousEmpresaLabel = previousRow
          ? fixPresentationText(formatEmpresaLabel(previousRow.empresa))
          : null;

        if (previousRow && previousEmpresaLabel !== empresaLabel) {
          const subtotalEmpresa = detalhamento
            .slice(0, rowIndex)
            .filter(
              (item) => fixPresentationText(formatEmpresaLabel(item.empresa)) === previousEmpresaLabel
            )
            .reduce((sum, item) => sum + item.valorRealTotal, 0);
          drawSubtotalRow(`Subtotal ${previousEmpresaLabel}`, subtotalEmpresa);
        }

        const rowHeight = getRowHeight(row);

        if (cursorY - rowHeight < availableBottom) {
          addPage();
          drawContinuationLabel();
          drawHeader();
        }

        const itemLines = wrapText(
          fontRegular,
          fixPresentationText(row.titulo),
          8.4,
          columnWidth("item") - 6
        ).slice(0, 4);
        const empresaLines = wrapText(
          fontRegular,
          empresaLabel,
          8.2,
          columnWidth("empresa") - 6
        ).slice(0, 2);
        const setorLines = wrapText(
          fontRegular,
          fixPresentationText(row.setorNome),
          8.2,
          columnWidth("setor") - 6
        ).slice(0, 2);
        const solicitanteLines = wrapText(
          fontRegular,
          fixPresentationText(row.solicitanteNome),
          8.2,
          columnWidth("solicitante") - 6
        ).slice(0, 2);
        const metodoLines = wrapText(
          fontRegular,
          formatMetodoPagamento(row.metodoPagamento),
          8.2,
          columnWidth("metodo") - 6
        ).slice(0, 2);
        const canalLines = wrapText(
          fontRegular,
          formatCanalCompra(row.canalCompra),
          8.2,
          columnWidth("canal") - 6
        ).slice(0, 2);

        page.drawRectangle({
          x: MARGIN_X,
          y: cursorY - rowHeight,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: COLORS.card,
          borderColor: COLORS.softLine,
          borderWidth: 0.4,
        });

        let x = MARGIN_X;
        const topY = cursorY - 11;

        drawText(formatNumber(rowIndex + 1), x + 3, topY, { size: 8.2 });
        x += columns[0].width;

        drawText(`#${row.solicitacaoId}`, x + 3, topY, { size: 8.2 });
        x += columns[1].width;

        drawText(formatDate(row.dataCompra), x + 3, topY, { size: 8.2 });
        x += columns[2].width;

        for (let i = 0; i < empresaLines.length; i += 1) {
          drawText(empresaLines[i], x + 3, topY - i * 9, { size: 8.2 });
        }
        x += columns[3].width;

        for (let i = 0; i < itemLines.length; i += 1) {
          drawText(itemLines[i], x + 3, topY - i * 9, { size: 8.4 });
        }
        x += columns[4].width;

        for (let i = 0; i < setorLines.length; i += 1) {
          drawText(setorLines[i], x + 3, topY - i * 9, { size: 8.2 });
        }
        x += columns[5].width;

        for (let i = 0; i < solicitanteLines.length; i += 1) {
          drawText(solicitanteLines[i], x + 3, topY - i * 9, { size: 8.2 });
        }
        x += columns[6].width;

        drawText(formatNumber(Math.trunc(row.quantidade)), x + columns[7].width - 3, topY, {
          size: 8.2,
          align: "right",
        });
        x += columns[7].width;

        drawText(
          row.valorRealUnitario === null ? "-" : formatCurrency(row.valorRealUnitario),
          x + columns[8].width - 3,
          topY,
          {
            size: 8.2,
            align: "right",
          }
        );
        x += columns[8].width;

        drawText(formatCurrency(row.valorRealTotal), x + columns[9].width - 3, topY, {
          size: 8.2,
          align: "right",
        });
        x += columns[9].width;

        drawText(formatParcelas(row), x, topY, {
          size: 8.2,
          align: "center",
          maxWidth: columns[10].width,
        });
        x += columns[10].width;

        for (let i = 0; i < metodoLines.length; i += 1) {
          drawText(metodoLines[i], x + 3, topY - i * 9, { size: 8.2 });
        }
        x += columns[11].width;

        for (let i = 0; i < canalLines.length; i += 1) {
          drawText(canalLines[i], x + 3, topY - i * 9, { size: 8.2 });
        }

        cursorY -= rowHeight + 4;
      }

      const lastRow = detalhamento[detalhamento.length - 1];
      if (lastRow) {
        const lastEmpresaLabel = fixPresentationText(formatEmpresaLabel(lastRow.empresa));
        const subtotalEmpresa = detalhamento
          .filter((item) => fixPresentationText(formatEmpresaLabel(item.empresa)) === lastEmpresaLabel)
          .reduce((sum, item) => sum + item.valorRealTotal, 0);
        drawSubtotalRow(`Subtotal ${lastEmpresaLabel}`, subtotalEmpresa);
        drawSubtotalRow("Total Geral", totalRealizado);
      }
    };

    drawHeaderBlock();
    drawSectionHeader(
      "Resumo executivo",
      "Indicadores consolidados para leitura rápida de diretoria e financeiro."
    );
    drawMetricCards();
    drawCompactFiltersTable();
    drawSectionHeader(
      "Blocos analíticos",
      "Distribuição financeira por empresa, setor, método, canal e status."
    );
    drawAnalyticsTable("Gastos por Empresa", gastosPorEmpresa);
    drawAnalyticsTable("Gastos por Setor", gastosPorSetor);
    drawAnalyticsTable("Gastos por Método de Pagamento", gastosPorMetodoPagamento);
    drawAnalyticsTable("Gastos por Canal / Local de Compra", gastosPorCanal);
    drawAnalyticsTable("Status das Compras", gastosPorStatus);
    drawDetailTable();

    for (let i = 0; i < pages.length; i += 1) {
      const currentPage = pages[i];
      currentPage.drawLine({
        start: { x: MARGIN_X, y: MARGIN_BOTTOM + FOOTER_HEIGHT - 6 },
        end: { x: PAGE_SIZE[0] - MARGIN_X, y: MARGIN_BOTTOM + FOOTER_HEIGHT - 6 },
        thickness: 0.6,
        color: COLORS.line,
      });

      currentPage.drawText("Portal Compras", {
        x: MARGIN_X,
        y: MARGIN_BOTTOM + 4,
        size: 8,
        font: fontBold,
        color: COLORS.muted,
      });

      const emittedLabel = `Emitido em ${formatDateTime(issuedAt)} | Uso interno`;
      currentPage.drawText(emittedLabel, {
        x: PAGE_SIZE[0] / 2 - fontRegular.widthOfTextAtSize(emittedLabel, 8) / 2,
        y: MARGIN_BOTTOM + 4,
        size: 8,
        font: fontRegular,
        color: COLORS.muted,
      });

      const pageLabel = `Página ${i + 1} de ${pages.length}`;
      currentPage.drawText(pageLabel, {
        x: PAGE_SIZE[0] - MARGIN_X - fontBold.widthOfTextAtSize(pageLabel, 8),
        y: MARGIN_BOTTOM + 4,
        size: 8,
        font: fontBold,
        color: COLORS.muted,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `relatorio-executivo-v2_1-${executivePeriod.startDate}_a_${executivePeriod.endDate}.pdf`;
    const pdfArrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;

    return new Response(pdfArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatório PDF.";
    return new Response(message, { status: 400 });
  }
}
