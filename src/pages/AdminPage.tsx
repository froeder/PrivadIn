import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/Card";
import type {
  AdminAuditLog,
  AppSettings,
  AppUser,
  PoopLog,
  RegistrationAttempt,
  RegistrationRequest,
} from "../types";
import { adjustUserPoints, removeLog, resetWeeklyRanking } from "../services/poopService";
import {
  updateCooldownMinutes,
  updatePointsPerLog,
} from "../services/settingsService";
import { formatDateTime } from "../utils/date";
import { toRoman } from "../utils/roman";

function actionLabel(action: AdminAuditLog["action"]) {
  if (action === "adjust_points") return "Ajuste de pontos";
  if (action === "remove_log") return "Registro removido";
  if (action === "update_cooldown") return "Cooldown atualizado";
  if (action === "update_points_per_log") return "Pontuacao atualizada";
  return "Reset semanal";
}

function attemptLabel(status: RegistrationAttempt["status"]) {
  if (status === "code_requested") return "Código solicitado";
  if (status === "invalid_code") return "Código inválido";
  if (status === "account_created") return "Conta criada";
  return "Falha";
}

function attemptClass(status: RegistrationAttempt["status"]) {
  if (status === "account_created") return "bg-emerald-400/15 text-emerald-100";
  if (status === "invalid_code" || status === "failed") return "bg-red-500/15 text-red-100";
  return "bg-yellow-300/15 text-yellow-100";
}

export function AdminPage({
  admin,
  users,
  logs,
  appSettings,
  auditLogs,
  registrationRequests,
  registrationAttempts,
}: {
  admin: AppUser;
  users: AppUser[];
  logs: PoopLog[];
  appSettings: AppSettings;
  auditLogs: AdminAuditLog[];
  registrationRequests: RegistrationRequest[];
  registrationAttempts: RegistrationAttempt[];
}) {
  const [busy, setBusy] = useState(false);
  const [cooldownInput, setCooldownInput] = useState(String(appSettings.cooldownMinutes));
  const [pointsInput, setPointsInput] = useState(String(appSettings.pointsPerLog));

  useEffect(() => {
    setCooldownInput(String(appSettings.cooldownMinutes));
  }, [appSettings.cooldownMinutes]);

  useEffect(() => {
    setPointsInput(String(appSettings.pointsPerLog));
  }, [appSettings.pointsPerLog]);

  const parsedCooldown = Number(cooldownInput);
  const isCooldownValid =
    Number.isInteger(parsedCooldown) && parsedCooldown >= 1 && parsedCooldown <= 1440;
  const parsedPoints = Number(pointsInput);
  const isPointsValid =
    Number.isInteger(parsedPoints) && parsedPoints >= 1 && parsedPoints <= 100000;

  async function runAdminAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error("A fiscalizacao tropeçou. Confira permissões e regras.");
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
            <p className="mt-2 text-sm text-slate-300">Edição atual: {toRoman(appSettings.edition)}</p>
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
          <p className="text-sm font-bold text-yellow-100">Configurações do app</p>
          <h2 className="text-2xl font-black text-white">Cooldown e pontuacao</h2>
          <p className="mt-1 text-sm text-slate-400">
            Defina em minutos o cooldown e quantos pontos cada registro deve valer.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-slate-300">Tempo em minutos</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              type="number"
              min={1}
              max={1440}
              step={1}
              value={cooldownInput}
              onChange={(event) => setCooldownInput(event.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Valor atual no app: {appSettings.cooldownMinutes} minuto{appSettings.cooldownMinutes === 1 ? "" : "s"}.
            </p>
            {!isCooldownValid ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                Informe um número inteiro entre 1 e 1440.
              </p>
            ) : null}
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-slate-300">Pontos por registro</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              type="number"
              min={1}
              max={100000}
              step={1}
              value={pointsInput}
              onChange={(event) => setPointsInput(event.target.value)}
            />
            <p className="mt-2 text-xs text-slate-500">
              Valor atual no app: {appSettings.pointsPerLog} pontos por registro.
            </p>
            {!isPointsValid ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                Informe um número inteiro entre 1 e 100000.
              </p>
            ) : null}
          </label>

          <div className="flex flex-col gap-3">
            <button
              disabled={busy || !isCooldownValid || parsedCooldown === appSettings.cooldownMinutes}
              onClick={() =>
                runAdminAction(
                  () => updateCooldownMinutes(admin, parsedCooldown),
                  `Cooldown atualizado para ${parsedCooldown} minuto(s).`,
                )
              }
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200 disabled:opacity-60"
            >
              Salvar cooldown
            </button>

            <button
              disabled={busy || !isPointsValid || parsedPoints === appSettings.pointsPerLog}
              onClick={() =>
                runAdminAction(
                  () => updatePointsPerLog(admin, parsedPoints),
                  `Pontuacao atualizada para ${parsedPoints} ponto(s) por registro.`,
                )
              }
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              Salvar pontuacao
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Solicitacoes de acesso</p>
          <h2 className="text-2xl font-black text-white">Codigos para novos usuarios</h2>
          <p className="mt-1 text-sm text-slate-400">
            Passe o código somente para quem você quer liberar. Cada email tem um código próprio.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {registrationRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400 lg:col-span-2">
              Nenhuma solicitação pendente. Quando alguém tentar entrar sem conta, aparece aqui.
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
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Código</p>
                  <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-yellow-200">
                    {request.approvalCode}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Tentativas de cadastro</p>
          <h2 className="text-2xl font-black text-white">Histórico de criação de conta</h2>
          <p className="mt-1 text-sm text-slate-400">
            Cada tentativa gera um documento próprio no Firestore, inclusive código inválido.
          </p>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {registrationAttempts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Nenhuma tentativa registrada ainda.
            </div>
          ) : (
            registrationAttempts.slice(0, 50).map((attempt) => (
              <div
                key={attempt.id}
                className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${attemptClass(attempt.status)}`}>
                      {attemptLabel(attempt.status)}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(attempt.createdAt)}</span>
                  </div>
                  <p className="mt-2 truncate font-black text-white">{attempt.email}</p>
                  {attempt.message ? (
                    <p className="mt-1 text-sm text-slate-400">{attempt.message}</p>
                  ) : null}
                </div>
                <div className="text-left md:text-right">
                  {attempt.approvalCodeProvided ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                        Código usado
                      </p>
                      <p className="font-mono text-lg font-black tracking-[0.16em] text-yellow-200">
                        {attempt.approvalCodeProvided}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">Sem código</p>
                  )}
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
                  onClick={() =>
                    runAdminAction(
                      () => adjustUserPoints(admin, user, -appSettings.pointsPerLog),
                      `${appSettings.pointsPerLog} pontos removidos. Auditoria respirando melhor.`,
                    )
                  }
                >
                  -{appSettings.pointsPerLog}
                </button>
                <button
                  disabled={busy}
                  className="rounded-xl bg-yellow-300 px-3 py-2 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60"
                  onClick={() =>
                    runAdminAction(
                      () => adjustUserPoints(admin, user, appSettings.pointsPerLog),
                      `${appSettings.pointsPerLog} pontos adicionados. Que conste em ata.`,
                    )
                  }
                >
                  +{appSettings.pointsPerLog}
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
          <h2 className="text-2xl font-black text-white">Histórico de alterações admin</h2>
          <p className="mt-1 text-sm text-slate-400">
            Toda ação manual registra o nome do admin responsável e o usuário afetado.
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
                        • Usuário afetado:{" "}
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
