import type { User } from "./User";

export type AccessGroup = "lider" | "diretoria" | "financeiro" | "tecnologia";

export const ACCESS_GROUP_ROLES: Record<AccessGroup, User["role"][]> = {
  lider: ["lider_setor", "user"],
  diretoria: ["diretora_financeiro", "diretora_empresa"],
  financeiro: ["financeiro"],
  tecnologia: ["ti", "admin"],
};

const KNOWN_ROLES = new Set<User["role"]>([
  "admin",
  "lider_setor",
  "diretora_financeiro",
  "diretora_empresa",
  "financeiro",
  "ti",
  "user",
]);

const ROLE_ALIASES: Record<string, User["role"]> = {
  lider: "lider_setor",
};

export function normalizeUserRole(role: string): User["role"] | null {
  const normalized = ROLE_ALIASES[role] ?? role;
  if (KNOWN_ROLES.has(normalized as User["role"])) {
    return normalized as User["role"];
  }

  return null;
}

export function getRolesForAccessGroups(
  ...groups: AccessGroup[]
): User["role"][] {
  const uniqueRoles = new Set<User["role"]>();

  for (const group of groups) {
    for (const role of ACCESS_GROUP_ROLES[group]) {
      uniqueRoles.add(role);
    }
  }

  return [...uniqueRoles];
}

export function hasAccessGroup(
  role: User["role"] | string,
  group: AccessGroup
): boolean {
  const normalizedRole = normalizeUserRole(role);
  if (!normalizedRole) return false;
  return ACCESS_GROUP_ROLES[group].includes(normalizedRole);
}

export function getAccessGroupForRole(
  role: User["role"] | string
): AccessGroup | null {
  for (const group of Object.keys(ACCESS_GROUP_ROLES) as AccessGroup[]) {
    if (hasAccessGroup(role, group)) {
      return group;
    }
  }

  return null;
}

export function canManageUsers(role: User["role"] | string): boolean {
  return hasAccessGroup(role, "tecnologia");
}

export function getDefaultRouteForRole(role: User["role"] | string): string {
  const normalizedRole = normalizeUserRole(role);

  if (!normalizedRole) {
    return "/login";
  }

  switch (normalizedRole) {
    case "lider_setor":
    case "user":
      return "/minhas-solicitacoes";
    case "diretora_financeiro":
    case "diretora_empresa":
    case "financeiro":
    case "ti":
    case "admin":
      return "/";
    default:
      return "/login";
  }
}
