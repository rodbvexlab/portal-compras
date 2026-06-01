import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

import styles from "./ConfirmDialog.module.css";

type ConfirmDialogVariant = "danger" | "warning" | "default";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Description className={styles.description}>
              {description}
            </Dialog.Description>
          </div>

          <div className={styles.footer}>
            <Dialog.Close asChild>
              <button
                type="button"
                className={styles.cancelButton}
                disabled={loading}
              >
                {cancelLabel}
              </button>
            </Dialog.Close>

            <button
              type="button"
              className={`${styles.confirmButton} ${styles[variant]}`}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? <Loader2 className={styles.spinner} aria-hidden="true" /> : null}
              {confirmLabel}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={styles.closeButton}
              aria-label="Fechar"
              disabled={loading}
            >
              <X aria-hidden="true" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
