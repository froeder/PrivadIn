import { useEffect, useMemo, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import type {
  AdminAuditLog,
  AppSettings,
  AppUser,
  PoopLog,
  PoopcoinSupplySummary,
  PoopcoinTransaction,
  RankedUser,
  RankingGroup,
  RegistrationAttempt,
  RegistrationRequest,
} from "../types";
import { logsRef, usersRef } from "../services/poopService";
import { adminLogsRef } from "../services/adminService";
import { groupsRef } from "../services/groupService";
import {
  registrationAttemptsRef,
  registrationRequestsRef,
} from "../services/registrationService";
import {
  appSettingsDocRef,
  defaultAppSettings,
  parseAppSettings,
} from "../services/settingsService";
import {
  parsePoopcoinSupplySummary,
  poopcoinChainHeadRef,
  poopcoinTransactionsRef,
} from "../services/poopcoinService";
import { rankUsers } from "../utils/ranking";

function sortLogs(logs: PoopLog[]): PoopLog[] {
  return [...logs].sort((a, b) => {
    const aTime =
      a.createdAt?.toMillis?.() ??
      (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
    const bTime =
      b.createdAt?.toMillis?.() ??
      (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
    return bTime - aTime;
  });
}

/**
 * Escuta em tempo real os usuários e logs para cálculo e desempate do ranking.
 */
export function useUsers(enabled = true) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<PoopLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      setLogs([]);
      setLoading(false);
      return;
    }

    const qUsers = query(usersRef, orderBy("totalPoints", "desc"));
    const unsubscribeUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        setUsers(
          snapshot.docs.map(
            (d) => ({ uid: d.id, ...(d.data() as any) }) as AppUser
          )
        );
        setLoading(false);
      },
      (error) => {
        console.warn("Erro ao ler ranking de usuarios:", error);
        setLoading(false);
      }
    );

    const qLogs = query(logsRef, orderBy("createdAt", "desc"), limit(200));
    const unsubscribeLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        const nextLogs = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as PoopLog
        );
        setLogs(sortLogs(nextLogs));
      },
      (error) => {
        console.warn("Erro ao ler logs para desempate do ranking:", error);
      }
    );

    return () => {
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, [enabled]);

  const rankedUsers = useMemo<RankedUser[]>(() => rankUsers(users, logs), [logs, users]);
  return { users, rankedUsers, logs, loading };
}

/**
 * Atalho reativo para obter a lista de usuários ranqueada.
 */
export function useRankedUsers(enabled = true) {
  const { rankedUsers, loading } = useUsers(enabled);
  return { rankedUsers, loading };
}

/**
 * Escuta os registros de cagada de um usuário específico em tempo real.
 */
export function useUserLogs(uid?: string, enabled = true) {
  const [logs, setLogs] = useState<PoopLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !uid) {
      setLogs([]);
      setLoading(false);
      return;
    }

    const q = query(
      logsRef,
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const nextLogs = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as PoopLog
        );
        setLogs(sortLogs(nextLogs));
        setLoading(false);
      },
      (error) => {
        console.warn("Erro ao ler historico do usuario:", error);
        setLoading(false);
      }
    );
  }, [enabled, uid]);

  return { logs, loading };
}

/**
 * Escuta o feed global de registros de cagada em tempo real (Analytics / Admin / Notificações).
 */
export function useAllLogs(enabled = true, limitCount = 100) {
  const [logs, setLogs] = useState<PoopLog[]>([]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      return;
    }

    const q = query(logsRef, orderBy("createdAt", "desc"), limit(limitCount));
    return onSnapshot(
      q,
      (snapshot) => {
        const nextLogs = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as PoopLog
        );
        setLogs(sortLogs(nextLogs));
      },
      (error) => {
        console.warn("Erro ao ler registros gerais:", error);
      }
    );
  }, [enabled, limitCount]);

  return logs;
}

/**
 * Escuta o log de auditoria administrativo em tempo real.
 */
export function useAdminAuditLogs(enabled = true, limitCount = 60) {
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  useEffect(() => {
    if (!enabled) {
      setAuditLogs([]);
      return;
    }

    const q = query(adminLogsRef, orderBy("createdAt", "desc"), limit(limitCount));
    return onSnapshot(
      q,
      (snapshot) => {
        setAuditLogs(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) }) as AdminAuditLog
          )
        );
      },
      (error) => {
        console.warn("Erro ao ler auditoria admin:", error);
      }
    );
  }, [enabled, limitCount]);

  return auditLogs;
}

/**
 * Escuta as solicitações de cadastro pendentes.
 */
export function useRegistrationRequests(enabled = true) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      return;
    }

    const q = query(registrationRequestsRef, orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        setRequests(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) }) as RegistrationRequest
          )
        );
      },
      (error) => {
        console.warn("Erro ao ler solicitacoes de cadastro:", error);
      }
    );
  }, [enabled]);

  return requests;
}

/**
 * Escuta as tentativas de cadastro na plataforma.
 */
export function useRegistrationAttempts(enabled = true, limitCount = 50) {
  const [attempts, setAttempts] = useState<RegistrationAttempt[]>([]);

  useEffect(() => {
    if (!enabled) {
      setAttempts([]);
      return;
    }

    const q = query(registrationAttemptsRef, orderBy("createdAt", "desc"), limit(limitCount));
    return onSnapshot(
      q,
      (snapshot) => {
        setAttempts(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) }) as RegistrationAttempt
          )
        );
      },
      (error) => {
        console.warn("Erro ao ler tentativas de cadastro:", error);
      }
    );
  }, [enabled, limitCount]);

  return attempts;
}

/**
 * Escuta todos os grupos/ligas criadas no aplicativo.
 */
export function useGroups(enabled = true) {
  const [groups, setGroups] = useState<RankingGroup[]>([]);

  useEffect(() => {
    if (!enabled) {
      setGroups([]);
      return;
    }

    const q = query(groupsRef, orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setGroups(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) }) as RankingGroup
          )
        );
      },
      (error) => {
        console.warn("Erro ao ler grupos:", error);
      }
    );
  }, [enabled]);

  return groups;
}

/**
 * Escuta as configurações globais do aplicativo em tempo real.
 */
export function useAppSettings(enabled = true) {
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setAppSettings(defaultAppSettings);
      setLoading(false);
      return;
    }

    return onSnapshot(
      appSettingsDocRef,
      (snapshot) => {
        setAppSettings(parseAppSettings(snapshot.data() as Partial<AppSettings> | undefined));
        setLoading(false);
      },
      (error) => {
        console.warn("Erro ao ler configuracoes do app:", error);
        setAppSettings(defaultAppSettings);
        setLoading(false);
      }
    );
  }, [enabled]);

  return { appSettings, loading };
}

/**
 * Escuta as transações do livro-caixa de Poopcoins.
 */
export function usePoopcoinTransactions(enabled = true, maxCount = 50) {
  const [transactions, setTransactions] = useState<PoopcoinTransaction[]>([]);

  useEffect(() => {
    if (!enabled) {
      setTransactions([]);
      return;
    }

    const q = query(poopcoinTransactionsRef, orderBy("sequence", "desc"), limit(maxCount));
    return onSnapshot(
      q,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map(
            (d) => ({ id: d.id, ...(d.data() as any) }) as PoopcoinTransaction
          )
        );
      },
      (error) => {
        console.warn("Erro ao ler ledger de Poopcoins:", error);
      }
    );
  }, [enabled, maxCount]);

  return transactions;
}

/**
 * Escuta o estado do fornecimento e blocos da blockchain Poopcoin.
 */
export function usePoopcoinSupply(enabled = true) {
  const [supply, setSupply] = useState<PoopcoinSupplySummary>(() => parsePoopcoinSupplySummary());

  useEffect(() => {
    if (!enabled) {
      setSupply(parsePoopcoinSupplySummary());
      return;
    }

    return onSnapshot(
      poopcoinChainHeadRef,
      (snapshot) => {
        setSupply(parsePoopcoinSupplySummary(snapshot.data() as Record<string, unknown> | undefined));
      },
      (error) => {
        console.warn("Erro ao ler suprimento de Poopcoins:", error);
        setSupply(parsePoopcoinSupplySummary());
      }
    );
  }, [enabled]);

  return supply;
}
