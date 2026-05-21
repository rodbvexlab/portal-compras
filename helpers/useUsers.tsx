import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "../endpoints/users/list_GET.schema";
import { postCreateUser, type InputType as CreateUserInput } from "../endpoints/users/create_POST.schema";
import { postUpdateUser, type InputType as UpdateUserInput } from "../endpoints/users/update_POST.schema";
import { postDeleteUser, type InputType as DeleteUserInput } from "../endpoints/users/delete_POST.schema";
import {
  postAdminResetPassword,
  type InputType as ResetPasswordInput,
} from "../endpoints/auth/admin_reset_password_POST.schema";

export const USERS_KEYS = {
  all: ["users"] as const,
  list: () => [...USERS_KEYS.all, "list"] as const,
};

export function useQueryUsers() {
  return useQuery({
    queryKey: USERS_KEYS.list(),
    queryFn: () => getUsers({}),
    staleTime: 60 * 1000,
  });
}

export function useMutationCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => postCreateUser(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

export function useMutationUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserInput) => postUpdateUser(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

export function useMutationResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ResetPasswordInput) => postAdminResetPassword(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}

export function useMutationDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteUserInput) => postDeleteUser(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: USERS_KEYS.all });
    },
  });
}
