import styles from "./Badge.module.css";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "primary"
    | "destructive"
    | "outline"
    | "secondary"
    | "success"
    | "warning"
    | "priorityEmergencial"
    | "priorityUrgente"
    | "priorityAlta"
    | "priorityMedia"
    | "priorityBaixa"
    | "statusPendingFinance"
    | "statusPendingBoard"
    | "statusApprovedPurchase"
    | "statusReturnedAdjust"
    | "statusRejected"
    | "statusInPurchase"
    | "statusPurchased"
    | "statusConcluded"
    | "statusCanceled";
  size?: "default" | "compact";
}

export const Badge = ({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: Props) => {
  return (
    <div
      className={`${styles.badge} ${size === "compact" ? styles.compact : ""} ${styles[variant]} ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
};
