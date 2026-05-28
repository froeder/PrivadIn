import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import type {
  AdminAuditLog,
  AppSettings,
  AppUser,
  PoopLog,
  RankedUser,
  RegistrationAttempt,
  RegistrationRequest,
} from "../types";
import {
  adminAuditLogsQuery,
  allLogsQuery,
  userLogsQuery,
  usersQuery,
} from "../services/poopService";
import { isFirebaseConfigured } from "../services/firebase";
import { rankUsers } from "../utils/ranking";
import {
  registrationAttemptsQuery,
  registrationRequestsQuery,
} from "../services/registrationService";
import {
  appSettingsDocRef,
  defaultAppSettings,
  parseAppSettings,
} from "../services/settingsService";

function sortLogs(logs: PoopLog[]) {
  return [...logs].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? 0;
    const bTime = b.createdAt?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

export function useUsers(enabled = true) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setUsers([]);
      setLoading(false);
      return;
    }

    return onSnapshot(
      usersQuery(),
      (snapshot) => {
        setUsers(snapshot.docs.map((doc) => doc.data() as AppUser));
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao ler ranking de usuários:", error);
        setLoading(false);
      },
    );
  }, [enabled]);

  const rankedUsers = useMemo<RankedUser[]>(() => rankUsers(users), [users]);
  return { users, rankedUsers, loading };
}

export function useUserLogs(uid?: string) {
  const [logs, setLogs] = useState<PoopLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) {
      setLogs([]);
      setLoading(false);
      return;
    }

    return onSnapshot(
      userLogsQuery(uid),
      (snapshot) => {
        const nextLogs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PoopLog);
        setLogs(sortLogs(nextLogs));
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao ler histórico do usuário:", error);
        setLoading(false);
      },
    );
  }, [uid]);

  return { logs, loading };
}

export function useAllLogs(enabled = true) {
  const [logs, setLogs] = useState<PoopLog[]>([]);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setLogs([]);
      return;
    }

    return onSnapshot(
      allLogsQuery(),
      (snapshot) => {
        const nextLogs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PoopLog);
        setLogs(sortLogs(nextLogs));
      },
      (error) => {
        console.error("Erro ao ler registros gerais:", error);
      },
    );
  }, [enabled]);

  return logs;
}

export function useAdminAuditLogs(enabled = true) {
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setAuditLogs([]);
      return;
    }

    return onSnapshot(
      adminAuditLogsQuery(),
      (snapshot) => {
        setAuditLogs(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdminAuditLog),
        );
      },
      (error) => {
        console.error("Erro ao ler auditoria admin:", error);
      },
    );
  }, [enabled]);

  return auditLogs;
}

export function useRegistrationRequests(enabled = true) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setRequests([]);
      return;
    }

    return onSnapshot(
      registrationRequestsQuery(),
      (snapshot) => {
        setRequests(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RegistrationRequest),
        );
      },
      (error) => {
        console.error("Erro ao ler solicitações de cadastro:", error);
      },
    );
  }, [enabled]);

  return requests;
}

export function useRegistrationAttempts(enabled = true) {
  const [attempts, setAttempts] = useState<RegistrationAttempt[]>([]);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
      setAttempts([]);
      return;
    }

    return onSnapshot(
      registrationAttemptsQuery(),
      (snapshot) => {
        setAttempts(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RegistrationAttempt),
        );
      },
      (error) => {
        console.error("Erro ao ler tentativas de cadastro:", error);
      },
    );
  }, [enabled]);

  return attempts;
}

export function useAppSettings(enabled = true) {
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled || !isFirebaseConfigured) {
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
        console.error("Erro ao ler configurações do app:", error);
        setAppSettings(defaultAppSettings);
        setLoading(false);
      },
    );
  }, [enabled]);

  return { appSettings, loading };
}
