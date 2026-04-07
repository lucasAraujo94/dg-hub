import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

// Ensure a single TRPC React client instance even if the module is bundled twice.
const createTRPC = () => createTRPCReact<AppRouter>();
const TRPC_GLOBAL_KEY = "__DG_TRPC_SINGLETON__";
const globalAny = globalThis as unknown as Record<string, ReturnType<typeof createTRPC> | undefined>;

export const trpc = globalAny[TRPC_GLOBAL_KEY] ?? createTRPC();
globalAny[TRPC_GLOBAL_KEY] = trpc;
