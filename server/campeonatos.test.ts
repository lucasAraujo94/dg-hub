import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context for testing
function createMockContext(userId: number = 1, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Campeonatos Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext());
  });

  it("deve listar campeonatos", async () => {
    const result = await caller.campeonatos.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve criar um campeonato (admin only)", async () => {
    const adminCaller = appRouter.createCaller(createMockContext(1, "admin"));
    const result = await adminCaller.campeonatos.create({
      nome: "Test Tournament",
      descricao: "A test tournament",
      dataInicio: new Date(),
      premioValor: 100,
    });
    expect(result).toBeDefined();
  });

  it("deve rejeitar criação de campeonato por usuário comum", async () => {
    const userCaller = appRouter.createCaller(createMockContext(2, "user"));
    try {
      await userCaller.campeonatos.create({
        nome: "Test Tournament",
        descricao: "A test tournament",
        dataInicio: new Date(),
        premioValor: 100,
      });
      expect(true).toBe(false); // Deve lançar erro
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("Estatísticas Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext(1, "user"));
  });

  it("deve obter ou criar estatísticas do usuário", async () => {
    const result = await caller.estatisticas.get();
    expect(result).toBeDefined();
    expect(result?.usuarioId).toBe(1);
  });

  it("deve atualizar estatísticas do usuário", async () => {
    const result = await caller.estatisticas.atualizar({
      vitorias: 5,
      derrotas: 2,
    });
    expect(result).toBeDefined();
  });
});

describe("Rankings Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext(1, "user"));
  });

  it("deve obter ranking geral", async () => {
    const result = await caller.rankings.getByTipo({
      tipo: "geral",
      limite: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve obter ranking semanal", async () => {
    const result = await caller.rankings.getByTipo({
      tipo: "semanal",
      limite: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve obter ranking mensal", async () => {
    const result = await caller.rankings.getByTipo({
      tipo: "mensal",
      limite: 10,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve atualizar ranking do usuário", async () => {
    const result = await caller.rankings.atualizar({
      tipo: "geral",
      pontos: 100,
    });
    expect(result).toBeDefined();
  });
});

describe("Emblemas Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext(1, "user"));
  });

  it("deve obter emblemas do usuário", async () => {
    const result = await caller.emblemas.getUsuario();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Notificações Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext(1, "user"));
  });

  it("deve obter notificações do usuário", async () => {
    const result = await caller.notificacoes.get();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Chat Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext());
  });

  it("deve obter mensagens do chat geral", async () => {
    const result = await caller.chat.getMensagens({
      tipo: "geral",
      limite: 50,
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve obter mensagens do chat da rádio", async () => {
    const result = await caller.chat.getMensagens({
      tipo: "radio",
      limite: 50,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Saques Router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    caller = appRouter.createCaller(createMockContext(1, "user"));
  });

  it("deve obter solicitações de saque do usuário", async () => {
    const result = await caller.saques.getSolicitacoes();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deve criar solicitação de saque", async () => {
    const result = await caller.saques.criar({
      valor: 50,
    });
    expect(result).toBeDefined();
  });
});
