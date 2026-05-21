import React, { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { toast } from "sonner";
import { Edit, KeyRound, Plus, Power, Trash2 } from "lucide-react";
import { ZodError } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/Dialog";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/Tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/Select";
import { Badge } from "../components/Badge";
import { Skeleton } from "../components/Skeleton";
import { Switch } from "../components/Switch";
import { UserRoleArrayValues, type UserRole } from "../helpers/schema";
import { formatDate, formatUserRole } from "../helpers/formatters";
import { useQuerySetores } from "../helpers/useSetores";
import {
  useMutationCreateUser,
  useMutationDeleteUser,
  useMutationResetUserPassword,
  useMutationUpdateUser,
  useQueryUsers,
} from "../helpers/useUsers";
import type { AdminUserListItem } from "../endpoints/users/list_GET.schema";
import styles from "./admin.usuarios.module.css";

type CreateFormState = {
  displayName: string;
  email: string;
  setorId: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  temporaryPassword: string;
};

type EditFormState = {
  userId: number;
  displayName: string;
  email: string;
  setorId: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
};

const DEFAULT_CREATE_FORM: CreateFormState = {
  displayName: "",
  email: "",
  setorId: "_empty",
  role: "user",
  isActive: true,
  mustChangePassword: true,
  temporaryPassword: "",
};

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || fallback;
  }

  if (error instanceof Error) {
    // Some endpoints return Zod errors as JSON-stringified array in message.
    if (error.message.startsWith("[")) {
      try {
        const parsed = JSON.parse(error.message) as Array<{ message?: string }>;
        const firstMessage = parsed?.[0]?.message;
        if (firstMessage) return firstMessage;
      } catch {
        // Keep default fallback below.
      }
    }

    return error.message || fallback;
  }

  return fallback;
}

function getFriendlyApiError(errorMessage: string, fallback: string): string {
  return getFriendlyErrorMessage(new Error(errorMessage), fallback);
}

function toEditForm(user: AdminUserListItem): EditFormState {
  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    setorId: user.setorId ? String(user.setorId) : "_empty",
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export default function AdminUsuariosPage() {
  const { data: users, isLoading } = useQueryUsers();
  const { data: setores } = useQuerySetores();
  const createUserMutation = useMutationCreateUser();
  const updateUserMutation = useMutationUpdateUser();
  const deleteUserMutation = useMutationDeleteUser();
  const resetPasswordMutation = useMutationResetUserPassword();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserListItem | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");

  const setoresOptions = useMemo(() => setores ?? [], [setores]);

  const filteredUsers = useMemo(() => {
    const source = users ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return source;
    return source.filter((item) => {
      const text = `${item.displayName} ${item.email} ${item.setorNome ?? ""} ${formatUserRole(item.role)}`.toLowerCase();
      return text.includes(query);
    });
  }, [users, search]);

  const resetCreateForm = () => setCreateForm(DEFAULT_CREATE_FORM);

  const openEditDialog = (user: AdminUserListItem) => {
    setEditForm(toEditForm(user));
    setEditOpen(true);
  };

  const openResetDialog = (user: AdminUserListItem) => {
    setResetTarget(user);
    setTemporaryPassword("");
    setResetOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createUserMutation.mutateAsync({
        displayName: createForm.displayName.trim(),
        email: createForm.email.trim().toLowerCase(),
        setorId: createForm.setorId === "_empty" ? null : Number(createForm.setorId),
        role: createForm.role,
        isActive: createForm.isActive,
        mustChangePassword: createForm.mustChangePassword,
        temporaryPassword: createForm.temporaryPassword,
      });

      if ("error" in result) {
        toast.error(
          getFriendlyApiError(result.error || "", "Falha ao criar usuário.")
        );
        return;
      }

      toast.success("Usuário criado com sucesso.");
      setCreateOpen(false);
      resetCreateForm();
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, "Falha ao criar usuário."));
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;

    try {
      const result = await updateUserMutation.mutateAsync({
        userId: editForm.userId,
        displayName: editForm.displayName.trim(),
        email: editForm.email.trim().toLowerCase(),
        setorId: editForm.setorId === "_empty" ? null : Number(editForm.setorId),
        role: editForm.role,
        isActive: editForm.isActive,
        mustChangePassword: editForm.mustChangePassword,
      });

      if ("error" in result) {
        toast.error(
          getFriendlyApiError(result.error || "", "Falha ao atualizar usuário.")
        );
        return;
      }

      toast.success("Usuário atualizado com sucesso.");
      setEditOpen(false);
      setEditForm(null);
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, "Falha ao atualizar usuário."));
    }
  };

  const handleToggleActive = async (user: AdminUserListItem) => {
    try {
      const result = await updateUserMutation.mutateAsync({
        userId: user.id,
        displayName: user.displayName,
        email: user.email,
        setorId: user.setorId,
        role: user.role,
        isActive: !user.isActive,
        mustChangePassword: user.mustChangePassword,
      });

      if ("error" in result) {
        toast.error(
          getFriendlyApiError(
            result.error || "",
            "Falha ao alterar status do usuário."
          )
        );
        return;
      }

      toast.success(!user.isActive ? "Usuário ativado." : "Usuário inativado.");
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, "Falha ao alterar status do usuário."));
    }
  };

  const handleDeleteUser = async (target: AdminUserListItem) => {
    const confirmed = window.confirm(
      `Confirma exclusão do usuário "${target.displayName}"?\n\nEssa ação remove o cadastro apenas quando não há vínculo histórico crítico.`
    );
    if (!confirmed) return;

    try {
      const result = await deleteUserMutation.mutateAsync({ userId: target.id });

      if ("error" in result) {
        if (result.requiresInactivation) {
          toast.error(
            "Exclusão bloqueada: usuário possui histórico relevante. Use Inativar para preservar auditoria."
          );
          return;
        }

        toast.error(
          getFriendlyApiError(result.error || "", "Falha ao excluir usuário.")
        );
        return;
      }

      toast.success("Usuário excluído com sucesso.");
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, "Falha ao excluir usuário."));
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;

    try {
      const result = await resetPasswordMutation.mutateAsync({
        userId: resetTarget.id,
        temporaryPassword: temporaryPassword.trim(),
      });

      if ("error" in result) {
        toast.error(
          getFriendlyApiError(result.error || "", "Falha ao redefinir senha.")
        );
        return;
      }

      toast.success("Senha provisória definida. Usuário deverá trocar no próximo acesso.");
      setResetOpen(false);
      setResetTarget(null);
      setTemporaryPassword("");
    } catch (error: unknown) {
      toast.error(getFriendlyErrorMessage(error, "Falha ao redefinir senha."));
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>Usuários - Administração</title>
      </Helmet>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestão de Usuários</h1>
          <p className={styles.subtitle}>Administre acessos, papéis, setor e segurança básica.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className={styles.headerPrimaryButton}>
              <Plus size={16} /> Novo usuário
            </Button>
          </DialogTrigger>
          <DialogContent className={styles.dialogContent}>
            <DialogHeader>
              <DialogTitle>Criar usuário</DialogTitle>
            </DialogHeader>

            <form className={styles.formLayout} onSubmit={handleCreateUser}>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Nome</label>
                  <Input
                    value={createForm.displayName}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Email/Login</label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Setor</label>
                  <Select
                    value={createForm.setorId}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({ ...prev, setorId: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Sem setor</SelectItem>
                      {setoresOptions.map((setor) => (
                        <SelectItem key={setor.id} value={String(setor.id)}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={styles.field}>
                  <label>Função</label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) =>
                      setCreateForm((prev) => ({ ...prev, role: value as UserRole }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UserRoleArrayValues.map((role) => (
                        <SelectItem key={role} value={role}>
                          {formatUserRole(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={styles.field}>
                <label>Senha provisória</label>
                <Input
                  type="password"
                  value={createForm.temporaryPassword}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, temporaryPassword: e.target.value }))
                  }
                  required
                />
              </div>

              <div className={styles.switchRow}>
                <label className={styles.switchItem}>
                  <Switch
                    checked={createForm.isActive}
                    onCheckedChange={(checked) =>
                      setCreateForm((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span>Conta ativa</span>
                </label>

                <label className={styles.switchItem}>
                  <Switch
                    checked={createForm.mustChangePassword}
                    onCheckedChange={(checked) =>
                      setCreateForm((prev) => ({ ...prev, mustChangePassword: checked }))
                    }
                  />
                  <span>Exigir troca de senha</span>
                </label>
              </div>

              <div className={styles.formFooter}>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Salvando..." : "Criar usuário"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className={styles.filterBar}>
        <Input
          placeholder="Buscar por nome, email, papel ou setor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colUsuario} />
            <col className={styles.colSetor} />
            <col className={styles.colPapel} />
            <col className={styles.colStatus} />
            <col className={styles.colSenha} />
            <col className={styles.colAcoes} />
          </colgroup>
          <thead>
            <tr>
              <th>Usuário / E-mail</th>
              <th>Setor</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Troca Senha</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, idx) => (
                    <td key={idx}>
                      <Skeleton className={styles.skeletonCell} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={6}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filteredUsers.map((item) => (
                <tr key={item.id}>
                  <td className={styles.userCell} title={`${item.displayName} • ${item.email}`}>
                    <span className={styles.userName}>{item.displayName}</span>
                    <span className={styles.userEmail}>{item.email}</span>
                  </td>
                  <td className={styles.wrapCell} title={item.setorNome || "-"}>
                    {item.setorNome || "-"}
                  </td>
                  <td className={styles.wrapCell} title={formatUserRole(item.role)}>
                    {formatUserRole(item.role)}
                  </td>
                  <td>
                    <Badge variant={item.isActive ? "success" : "secondary"}>
                      {item.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      variant={item.mustChangePassword ? "warning" : "outline"}
                      title={item.mustChangePassword ? "Troca obrigatória" : "Sem obrigatoriedade"}
                    >
                      {item.mustChangePassword ? "Obrig." : "Normal"}
                    </Badge>
                  </td>
                  <td className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            className={`${styles.actionIcon} ${styles.actionEdit}`}
                            onClick={() => openEditDialog(item)}
                            aria-label="Editar usuário"
                          >
                            <Edit size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar usuário</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={`${styles.actionIcon} ${
                              item.isActive ? styles.actionInactivate : styles.actionActivate
                            }`}
                            onClick={() => handleToggleActive(item)}
                            disabled={updateUserMutation.isPending}
                            aria-label={item.isActive ? "Inativar usuário" : "Ativar usuário"}
                          >
                            <Power size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{item.isActive ? "Inativar usuário" : "Ativar usuário"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className={`${styles.actionIcon} ${styles.actionReset}`}
                            onClick={() => openResetDialog(item)}
                            aria-label="Resetar senha provisória"
                          >
                            <KeyRound size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resetar senha</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon-sm"
                            variant="destructive"
                            className={`${styles.actionIcon} ${styles.actionDelete}`}
                            onClick={() => handleDeleteUser(item)}
                            disabled={deleteUserMutation.isPending}
                            aria-label="Excluir usuário"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir usuário</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>

          {editForm && (
            <form className={styles.formLayout} onSubmit={handleEditUser}>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Nome</label>
                  <Input
                    value={editForm.displayName}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, displayName: e.target.value } : prev))
                    }
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label>Email/Login</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                    }
                    required
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label>Setor</label>
                  <Select
                    value={editForm.setorId}
                    onValueChange={(value) =>
                      setEditForm((prev) => (prev ? { ...prev, setorId: value } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_empty">Sem setor</SelectItem>
                      {setoresOptions.map((setor) => (
                        <SelectItem key={setor.id} value={String(setor.id)}>
                          {setor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className={styles.field}>
                  <label>Função</label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value) =>
                      setEditForm((prev) => (prev ? { ...prev, role: value as UserRole } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UserRoleArrayValues.map((role) => (
                        <SelectItem key={role} value={role}>
                          {formatUserRole(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className={styles.switchRow}>
                <label className={styles.switchItem}>
                  <Switch
                    checked={editForm.isActive}
                    onCheckedChange={(checked) =>
                      setEditForm((prev) => (prev ? { ...prev, isActive: checked } : prev))
                    }
                  />
                  <span>Conta ativa</span>
                </label>

                <label className={styles.switchItem}>
                  <Switch
                    checked={editForm.mustChangePassword}
                    onCheckedChange={(checked) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, mustChangePassword: checked } : prev
                      )
                    }
                  />
                  <span>Exigir troca de senha</span>
                </label>
              </div>

              <div className={styles.formFooter}>
                <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>Redefinir senha provisória</DialogTitle>
          </DialogHeader>
          <form className={styles.formLayout} onSubmit={handleResetPassword}>
            <p className={styles.resetMessage}>
              {resetTarget
                ? `Defina a nova senha provisória para ${resetTarget.displayName}.`
                : "Selecione um usuário."}
            </p>
            <div className={styles.field}>
              <label>Nova senha provisória</label>
              <Input
                type="password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                required
              />
            </div>
            <div className={styles.formFooter}>
              <Button type="button" variant="ghost" onClick={() => setResetOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? "Aplicando..." : "Redefinir senha"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}







