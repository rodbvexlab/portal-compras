import { useMemo, useState, type FormEvent } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import superjson from "superjson";

import { Button } from "../Button";
import { Textarea } from "../Textarea";
import { toastError, toastSuccess } from "../../helpers/toast";
import { formatDate } from "../../helpers/formatters";
import { SOLICITACAO_DETAIL_KEYS } from "../../helpers/useSolicitacaoDetail";

import styles from "./ComentariosSolicitacao.module.css";

export type ComentarioSolicitacaoItem = {
  id: number;
  texto: string;
  createdAt: string | null;
  usuarioNome: string;
};

type ComentariosSolicitacaoProps = {
  solicitacaoId: number;
  status: string;
  comentarios: ComentarioSolicitacaoItem[];
};

const MAX_COMMENT_LENGTH = 2000;
const CLOSED_STATUSES = new Set(["concluido", "rejeitado"]);

function getInitials(nome: string) {
  const parts = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

async function postComentario(payload: { solicitacaoId: number; texto: string }) {
  const response = await fetch("/_api/solicitacoes/comentario", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: superjson.stringify(payload),
  });

  const text = await response.text();
  const data = text ? superjson.parse<any>(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao adicionar comentário.");
  }

  return data;
}

export function ComentariosSolicitacao({
  solicitacaoId,
  status,
  comentarios,
}: ComentariosSolicitacaoProps) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState("");
  const trimmedText = texto.trim();
  const isClosed = CLOSED_STATUSES.has(status);
  const remainingCharacters = MAX_COMMENT_LENGTH - texto.length;

  const orderedComentarios = useMemo(
    () =>
      [...comentarios].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
      ),
    [comentarios]
  );

  const comentarioMutation = useMutation({
    mutationFn: postComentario,
    onSuccess: async () => {
      setTexto("");
      await queryClient.invalidateQueries({
        queryKey: SOLICITACAO_DETAIL_KEYS.detail(solicitacaoId),
        refetchType: "active",
      });
      toastSuccess("Comentário adicionado.");
    },
    onError: () => {
      toastError("Erro ao adicionar comentário.");
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!trimmedText || trimmedText.length > MAX_COMMENT_LENGTH) {
      return;
    }

    comentarioMutation.mutate({
      solicitacaoId,
      texto: trimmedText,
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Comentários</h2>

      {orderedComentarios.length === 0 ? (
        <p className={styles.emptyText}>Nenhum comentário registrado.</p>
      ) : (
        <div className={styles.timeline}>
          {orderedComentarios.map((comentario) => (
            <article key={comentario.id} className={styles.timelineItem}>
              <div className={styles.avatar} aria-hidden="true">
                {getInitials(comentario.usuarioNome)}
              </div>
              <div className={styles.commentContent}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{comentario.usuarioNome}</span>
                  <span className={styles.commentDate}>{formatDate(comentario.createdAt)}</span>
                </div>
                <p className={styles.commentText}>{comentario.texto}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {!isClosed ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.textareaWrap}>
            <MessageSquare size={18} className={styles.formIcon} aria-hidden="true" />
            <Textarea
              value={texto}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Adicionar comentário..."
              className={styles.textarea}
              disabled={comentarioMutation.isPending}
            />
          </div>
          <div className={styles.formFooter}>
            <span
              className={styles.counter}
              data-over-limit={remainingCharacters < 0 ? "true" : "false"}
            >
              {texto.length}/{MAX_COMMENT_LENGTH}
            </span>
            <Button
              type="submit"
              disabled={
                comentarioMutation.isPending ||
                trimmedText.length === 0 ||
                trimmedText.length > MAX_COMMENT_LENGTH
              }
            >
              {comentarioMutation.isPending ? (
                <Loader2 className={styles.spinner} size={16} />
              ) : (
                <Send size={16} />
              )}
              Comentar
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
