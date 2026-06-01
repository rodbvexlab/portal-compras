import { toast } from "sonner";

export function toastSuccess(message: string): void {
  toast.success(message);
}

export function toastError(message: string): void {
  toast.error(message);
}

export function toastWarning(message: string): void {
  toast.warning(message);
}

export function toastLoading(message: string): string | number {
  return toast.loading(message);
}

export function toastDismiss(id: string | number): void {
  toast.dismiss(id);
}
