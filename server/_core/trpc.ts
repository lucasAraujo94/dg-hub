import { COOKIE_NAME, NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  // Refresh sliding session (10 minutos) a cada requisição autenticada
  try {
    const sessionToken = await sdk.createSessionToken(ctx.user.openId, {
      name: ctx.user.name ?? ctx.user.email ?? "",
      expiresInMs: 10 * 60 * 1000,
    });
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 10 * 60 * 1000 });
  } catch (error) {
    console.warn("[auth] refresh de sessão falhou", error);
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
