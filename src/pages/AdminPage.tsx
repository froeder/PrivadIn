import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
import { formatNumber } from "../utils/format";
import { toRoman } from "../utils/roman";
import {
  buildUsersById,
  formatAuditLogMessage,
  resolveUserDisplayName,
} from "../utils/auditLog";

function actionLabel(action: AdminAuditLog["action"], t: (key: string) => string) {
  return t(`actionLabels.${action}`);
}

function attemptLabel(status: RegistrationAttempt["status"], t: (key: string) => string) {
  return t(`attemptLabels.${status}`);
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
  const { t } = useTranslation("admin");
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
  const usersById = useMemo(() => buildUsersById(users), [users]);

  async function runAdminAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch {
      toast.error(t("toast.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-yellow-100">{t("heroEyebrow")}</p>
            <h2 className="text-2xl font-black text-white">{t("heroTitle")}</h2>
            <p className="mt-1 text-sm text-slate-400">{t("heroDescription")}</p>
            <p className="mt-2 text-sm text-slate-300">{t("common:labels.currentEdition", { edition: toRoman(appSettings.edition) })}</p>
          </div>
          <button
            disabled={busy}
            onClick={() => runAdminAction(() => resetWeeklyRanking(admin, logs, users), t("toast.weeklyResetSuccess"))}
            className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200 disabled:opacity-60"
          >
            {t("actions.weeklyReset")}
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">{t("settingsEyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("settingsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("settingsDescription")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-slate-300">{t("cooldownLabel")}</span>
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
              {t("cooldownCurrent", { count: appSettings.cooldownMinutes })}
            </p>
            {!isCooldownValid ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                {t("cooldownInvalid")}
              </p>
            ) : null}
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-slate-300">{t("pointsLabel")}</span>
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
              {t("pointsCurrent", { points: formatNumber(appSettings.pointsPerLog) })}
            </p>
            {!isPointsValid ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                {t("pointsInvalid")}
              </p>
            ) : null}
          </label>

          <div className="flex flex-col gap-3">
            <button
              disabled={busy || !isCooldownValid || parsedCooldown === appSettings.cooldownMinutes}
              onClick={() =>
                runAdminAction(
                  () => updateCooldownMinutes(admin, parsedCooldown),
                  t("toast.cooldownSuccess", { count: parsedCooldown }),
                )
              }
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 transition hover:bg-yellow-200 disabled:opacity-60"
            >
              {t("actions.saveCooldown")}
            </button>

            <button
              disabled={busy || !isPointsValid || parsedPoints === appSettings.pointsPerLog}
              onClick={() =>
                runAdminAction(
                  () => updatePointsPerLog(admin, parsedPoints),
                  t("toast.pointsSuccess", { points: formatNumber(parsedPoints) }),
                )
              }
              className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {t("actions.savePoints")}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">{t("requestsEyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("requestsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("requestsDescription")}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {registrationRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400 lg:col-span-2">
              {t("requestsEmpty")}
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
                    {request.status === "pending" ? t("requestStatusPending") : t("requestStatusUsed")}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-950/60 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">{t("requestCodeLabel")}</p>
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
          <p className="text-sm font-bold text-yellow-100">{t("attemptsEyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("attemptsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("attemptsDescription")}
          </p>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {registrationAttempts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              {t("attemptsEmpty")}
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
                      {attemptLabel(attempt.status, (key) => t(key))}
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
                        {t("attemptCodeUsed")}
                      </p>
                      <p className="font-mono text-lg font-black tracking-[0.16em] text-yellow-200">
                        {attempt.approvalCodeProvided}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">{t("attemptWithoutCode")}</p>
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
            <p className="text-sm font-bold text-yellow-100">{t("manualEyebrow")}</p>
            <h2 className="text-2xl font-black text-white">{t("manualTitle")}</h2>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full bg-yellow-100" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{user.name}</p>
                  <p className="text-xs text-slate-400">{t("userPoints", { points: formatNumber(user.totalPoints) })}</p>
                </div>
                <button
                  disabled={busy}
                  className="rounded-xl bg-white/10 px-3 py-2 font-black text-white hover:bg-white/20 disabled:opacity-60"
                  onClick={() =>
                    runAdminAction(
                      () => adjustUserPoints(admin, user, -appSettings.pointsPerLog),
                      t("toast.removePoints", { points: formatNumber(appSettings.pointsPerLog) }),
                    )
                  }
                >
                  -{formatNumber(appSettings.pointsPerLog)}
                </button>
                <button
                  disabled={busy}
                  className="rounded-xl bg-yellow-300 px-3 py-2 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60"
                  onClick={() =>
                    runAdminAction(
                      () => adjustUserPoints(admin, user, appSettings.pointsPerLog),
                      t("toast.addPoints", { points: formatNumber(appSettings.pointsPerLog) }),
                    )
                  }
                >
                  +{formatNumber(appSettings.pointsPerLog)}
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-yellow-100">{t("recentLogsEyebrow")}</p>
            <h2 className="text-2xl font-black text-white">{t("recentLogsTitle")}</h2>
          </div>
          <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-yellow-300/15 text-xl">🧻</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">
                    {resolveUserDisplayName(usersById, log.userId, log.userName)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => runAdminAction(() => removeLog(admin, log), t("toast.removeLog"))}
                  className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-black text-red-100 hover:bg-red-500/25 disabled:opacity-60"
                >
                  {t("common:actions.remove")}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">{t("auditEyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("auditTitle")}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {t("auditDescription")}
          </p>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              {t("auditEmpty")}
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
                      {actionLabel(auditLog.action, (key) => t(key))}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(auditLog.createdAt)}</span>
                  </div>
                  <p className="mt-2 font-black text-white">
                    {formatAuditLogMessage(auditLog, usersById, t)}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {t("auditAdmin")}:{" "}
                    <span className="text-slate-200">
                      {resolveUserDisplayName(usersById, auditLog.adminId, auditLog.adminName)}
                    </span>
                    {auditLog.targetUserId ? (
                      <>
                        {" "}
                        • {t("auditTarget")}:{" "}
                        <span className="text-slate-200">
                          {resolveUserDisplayName(
                            usersById,
                            auditLog.targetUserId,
                            auditLog.targetUserName,
                          )}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  {typeof auditLog.delta === "number" ? (
                    <p className={auditLog.delta > 0 ? "font-black text-emerald-200" : "font-black text-red-200"}>
                      {auditLog.delta > 0 ? "+" : ""}
                      {t("auditDelta", { count: Math.abs(auditLog.delta) })}
                    </p>
                  ) : null}
                  {typeof auditLog.points === "number" ? (
                    <p className="font-black text-red-200">-{t("auditDelta", { count: auditLog.points })}</p>
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
