import {type GeneratedAlways, Kysely, CamelCasePlugin} from 'kysely'
import {PostgresJSDialect} from 'kysely-postgres-js'
import {DB} from './schema'
import postgres from 'postgres'

function parsePositiveInteger(value: string | undefined, fallback: number) {
const parsed = Number.parseInt(value ?? '', 10)
return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const poolMax = parsePositiveInteger(process.env.DB_POOL_MAX, 12)
const idleTimeoutSeconds = parsePositiveInteger(process.env.DB_IDLE_TIMEOUT_SECONDS, 20)

export const db = new Kysely<DB>({
plugins: [new CamelCasePlugin()],
dialect: new PostgresJSDialect({
postgres: postgres(process.env.FLOOT_DATABASE_URL, {
prepare: false,
idle_timeout: idleTimeoutSeconds,
max: poolMax,
}),
}),
})
