import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as z from "zod";
import { Helmet } from "react-helmet";
import { useAuth } from "../helpers/useAuth";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "../components/Form";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Spinner } from "../components/Spinner";
import { postChangePassword } from "../endpoints/auth/change_password_POST.schema";
import styles from "./trocar-senha.module.css";

const changePasswordUiSchema = z
  .object({
    currentPassword: z.string().min(6, "Senha atual deve ter pelo menos 6 caracteres"),
    newPassword: z
      .string()
      .min(6, "Nova senha deve ter pelo menos 6 caracteres"),
    confirmNewPassword: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "A confirmação não confere com a nova senha",
  });

type ChangePasswordUiData = z.infer<typeof changePasswordUiSchema>;

export default function TrocarSenha() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const form = useForm({
    schema: changePasswordUiSchema,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const handleSubmit = async (data: ChangePasswordUiData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await postChangePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });

      if ("success" in result && result.success) {
        setSuccessMessage("Senha atualizada com sucesso. Faça login novamente.");
        await logout();
        navigate("/login", { replace: true });
        return;
      }

      setError(result.error || "Falha ao atualizar senha.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Trocar Senha - Portal de Compras</title>
      </Helmet>

      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Troca obrigatória de senha</h1>
          <p className={styles.subtitle}>
            Para continuar no sistema, atualize sua senha agora.
          </p>
        </div>

        <Form {...form}>
          {error && <div className={styles.errorMessage}>{error}</div>}
          {successMessage && (
            <div className={styles.successMessage}>{successMessage}</div>
          )}

          <form
            onSubmit={form.handleSubmit((values) =>
              handleSubmit(values as ChangePasswordUiData)
            )}
            className={styles.form}
          >
            <FormItem name="currentPassword">
              <FormLabel>Senha atual</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={form.values.currentPassword || ""}
                  onChange={(e) =>
                    form.setValues((prev: any) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="newPassword">
              <FormLabel>Nova senha</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={form.values.newPassword || ""}
                  onChange={(e) =>
                    form.setValues((prev: any) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormDescription>
                Use ao menos 6 caracteres.
              </FormDescription>
              <FormMessage />
            </FormItem>

            <FormItem name="confirmNewPassword">
              <FormLabel>Confirmar nova senha</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  value={form.values.confirmNewPassword || ""}
                  onChange={(e) =>
                    form.setValues((prev: any) => ({
                      ...prev,
                      confirmNewPassword: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <Button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? (
                <>
                  <Spinner size="sm" /> Atualizando...
                </>
              ) : (
                "Atualizar senha"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
