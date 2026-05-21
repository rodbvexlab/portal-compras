import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "./Button";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Spinner } from "./Spinner";

import {
  postLogin,
  schema,
} from "../endpoints/auth/login_with_password_POST.schema";
import { getDefaultRouteForRole } from "../helpers/accessGroups";
import { useAuth } from "../helpers/useAuth";

import styles from "./PasswordLoginForm.module.css";

export type LoginFormData = z.infer<typeof schema>;

interface PasswordLoginFormProps {
  className?: string;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    schema,
  });

  const handleSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postLogin(data);
      console.log("login_with_password result:", result);

      if (result?.user) {
        const passwordChangeRequired = Boolean(result.passwordChangeRequired);
        onLogin(result.user, { passwordChangeRequired });
        navigate(
          passwordChangeRequired
            ? "/trocar-senha"
            : getDefaultRouteForRole(result.user.role)
        );
        return;
      }

      setError("Falha ao concluir o login.");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Nao foi possivel concluir o login."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="email" className={styles.field}>
          <FormLabel className={styles.label}>Email corporativo</FormLabel>
          <FormControl>
            <Input
              className={styles.input}
              placeholder="nome@empresa.com.br"
              type="email"
              autoComplete="email"
              disabled={isLoading}
              value={form.values.email}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="password" className={styles.field}>
          <FormLabel className={styles.label}>Senha</FormLabel>
          <FormControl>
            <Input
              className={styles.input}
              type="password"
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={isLoading}
              value={form.values.password}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <span className={styles.loadingText}>
              <Spinner className={styles.spinner} size="sm" />
              Entrando...
            </span>
          ) : (
            "Entrar no portal"
          )}
        </Button>
      </form>
    </Form>
  );
};
