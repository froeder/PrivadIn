import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/Card";
import type { AdminAuditLog, AppUser, PoopLog, RegistrationRequest } from "../types";
import { adjustUserPoints, removeLog, resetWeeklyRanking } from "../services/poopService";
import { formatDateTime } from "../utils/date";

function actionLabel(action: AdminAuditLog["action"]) {
  if (action === "adjust_points") return "Ajuste de pontos";
  if (action === "remove_log") return "Registro removido";
  return "Reset semanal";
}

export function AdminPage({
  admin,
  users,
  logs,
  auditLogs,
  registrationRequests,
}: {
  admin: AppUser;
  users: AppUser[];
  logs: PoopLog[];
  auditLogs: AdminAuditLog[];
  registrationRequests: RegistrationRequest[];
}) {
  const [busy, setBusy] = useState(false);

  async function runAdminAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("A fiscalizacao tropeçou. Confira permissoes e regras.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-yellow-100">Modo admin</p>
            <h2 className="text-2xl font-black text-white">Painel da fiscalizacao sanitaria</h2>
            <p className="mt-1 text-sm text-slate-400">Use com sabedoria. Grandes poderes, grandes planilhas.</p>
          </div>
          <button
            disabled={busy}
            onClick={() => runAdminAction(() => resetWeeklyRanking(admin, logs, users), "Ranking semanal zerado. Segunda-feira moral restaurada.")}
            className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200 disabled:opacity-60"
          >
            Resetar ranking semanal
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Solicitacoes de acesso</p>
          <h2 className="text-2xl font-black text-white">Codigos para novos usuarios</h2>
          <p className="mt-1 text-sm text-slate-400">
            Passe o codigo somente para quem voce quer liberar. Cada email tem um codigo proprio.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {registrationRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400 lg:col-span-2">
              Nenhuma solicitacao pendente. Quando alguem tentar entrar sem conta, aparece aqui.
            </div>
          ) : (
            registrationRequests.slice(0, 12).map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-white">{request.email}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(request.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-black text-slate-300">
                    {request.status === "pending" ? "Pendente" : "Usado"}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Codigo</p>
                  <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-yellow-200">
                    {request.approvalCode}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">Ajuste manual</p>
            <h2 className="text-2xl font-black text-white">Pontuacao dos usuarios</h2>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full bg-yellow-100" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.totalPoints} pontos gerais</p>
                </div>
                <button
                  disabled={busy}
                  className="rounded-xl bg-white/10 px-3 py-2 font-black text-white hover:bg-white/20 disabled:opacity-60"
                  onClick={() => runAdminAction(() => adjustUserPoints(admin, user, -1), "Ponto removido. Auditoria respirando melhor.")}
                >
                  -1
                </button>
                <button
                  disabled={busy}
                  className="rounded-xl bg-yellow-300 px-3 py-2 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60"
                  onClick={() => runAdminAction(() => adjustUserPoints(admin, user, 1), "Ponto adicionado. Que conste em ata.")}
                >
                  +1
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">Registros recentes</p>
            <h2 className="text-2xl font-black text-white">Remover indevidos</h2>
          </div>
          <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-yellow-300/15 text-xl">🧻</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{log.userName}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => runAdminAction(() => removeLog(admin, log), "Registro removido. O placar foi desentupido.")}
                  className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-black text-red-100 hover:bg-red-500/25 disabled:opacity-60"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Auditoria</p>
          <h2 className="text-2xl font-black text-white">Historico de alteracoes admin</h2>
          <p className="mt-1 text-sm text-slate-400">
            Toda acao manual registra o nome do admin responsavel e o usuario afetado.
          </p>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Nenhuma alteracao administrativa registrada ainda.
            </div>
          ) : (
            auditLogs.slice(0, 50).map((auditLog) => (
              <div
                key={auditLog.id}
                className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-yellow-300/15 px-2 py-1 text-xs font-black text-yellow-100">
                      {actionLabel(auditLog.action)}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(auditLog.createdAt)}</span>
                  </div>
                  <p className="mt-2 font-black text-white">{auditLog.description}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Admin: <span className="text-slate-200">{auditLog.adminName}</span>
                    {auditLog.targetUserName ? (
                      <>
                        {" "}
                        • Usuario afetado:{" "}
                        <span className="text-slate-200">{auditLog.targetUserName}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  {typeof auditLog.delta === "number" ? (
                    <p className={auditLog.delta > 0 ? "font-black text-emerald-200" : "font-black text-red-200"}>
                      {auditLog.delta > 0 ? "+" : ""}
                      {auditLog.delta} ponto
                    </p>
                  ) : null}
                  {typeof auditLog.points === "number" ? (
                    <p className="font-black text-red-200">-{auditLog.points} ponto</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
