import { canManageUsers } from "../../helpers/accessGroups";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./delete_POST.schema";

type CountResult = {
  total: number;
};

async function canDeleteOauthAccounts() {
  try {
    await db
      .selectFrom("oauthAccounts")
      .select("id")
      .limit(1)
      .executeTakeFirst();
    return true;
  } catch (error: any) {
    // Some environments may not have oauth_accounts table yet.
    if (error?.code === "42P01") {
      return false;
    }
    throw error;
  }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (!canManageUsers(user.role)) {
      return Response.json({ error: "Acesso negado." }, { status: 403 });
    }

    const json = await request.json();
    const payload = schema.parse(json);

    if (payload.userId === user.id) {
      return Response.json(
        { error: "Não é permitido excluir o próprio usuário." },
        { status: 400 }
      );
    }

    const targetUser = await db
      .selectFrom("users")
      .select(["id", "displayName", "isActive"])
      .where("id", "=", payload.userId)
      .limit(1)
      .executeTakeFirst();

    if (!targetUser) {
      return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const [solicitacoesCount, aprovacoesCount, historicoCount] = await Promise.all([
      db
        .selectFrom("solicitacoes")
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .where("solicitanteId", "=", payload.userId)
        .executeTakeFirst(),
      db
        .selectFrom("aprovacoes")
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .where("aprovadorId", "=", payload.userId)
        .executeTakeFirst(),
      db
        .selectFrom("historicoStatus")
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .where("usuarioId", "=", payload.userId)
        .executeTakeFirst(),
    ]);

    const links = {
      solicitacoes: Number((solicitacoesCount as CountResult | undefined)?.total ?? 0),
      aprovacoes: Number((aprovacoesCount as CountResult | undefined)?.total ?? 0),
      historicoStatus: Number((historicoCount as CountResult | undefined)?.total ?? 0),
    };

    const hasCriticalLinks =
      links.solicitacoes > 0 || links.aprovacoes > 0 || links.historicoStatus > 0;

    if (hasCriticalLinks) {
      return Response.json(
        {
          error:
            "Usuário possui vínculo com histórico operacional e não pode ser excluído. Use inativação.",
          requiresInactivation: true,
          links,
        },
        { status: 409 }
      );
    }

    const hasOauthAccountsTable = await canDeleteOauthAccounts();

    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom("sessions").where("userId", "=", payload.userId).execute();
      if (hasOauthAccountsTable) {
        await trx.deleteFrom("oauthAccounts").where("userId", "=", payload.userId).execute();
      }
      await trx.deleteFrom("userPasswords").where("userId", "=", payload.userId).execute();
      await trx.deleteFrom("users").where("id", "=", payload.userId).executeTakeFirst();
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error: any) {
    // PostgreSQL foreign key violation (safety fallback for unexpected relationships).
    if (error?.code === "23503") {
      return Response.json(
        {
          error:
            "Não foi possível excluir por vínculo de integridade. Utilize inativação para preservar histórico.",
          requiresInactivation: true,
        },
        { status: 409 }
      );
    }

    return Response.json(
      { error: error?.message || "Erro ao excluir usuário." },
      { status: 400 }
    );
  }
}

