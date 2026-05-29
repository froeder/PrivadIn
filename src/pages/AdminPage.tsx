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
  if (status === "account_created") return "bg-success-soft/45 text-success";
  if (status === "invalid_code" || status === "failed") return "bg-danger-soft/45 text-danger";
  return "bg-accent-soft/35 text-accent-strong";
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
            <p className="text-sm font-bold text-accent-strong">{t("heroEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">{t("heroTitle")}</h2>
            <p className="mt-1 text-sm text-fg-muted">{t("heroDescription")}</p>
            <p className="mt-2 text-sm text-fg-soft">{t("common:labels.currentEdition", { edition: toRoman(appSettings.edition) })}</p>
          </div>
          <button
            disabled={busy}
            onClick={() => runAdminAction(() => resetWeeklyRanking(admin, logs, users), t("toast.weeklyResetSuccess"))}
            className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
          >
            {t("actions.weeklyReset")}
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("settingsEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("settingsTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {t("settingsDescription")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-fg-soft">{t("cooldownLabel")}</span>
            <input
              className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
              type="number"
              min={1}
              max={1440}
              step={1}
              value={cooldownInput}
              onChange={(event) => setCooldownInput(event.target.value)}
            />
            <p className="mt-2 text-xs text-fg-muted">
              {t("cooldownCurrent", { count: appSettings.cooldownMinutes })}
            </p>
            {!isCooldownValid ? (
              <p className="mt-1 text-xs font-semibold text-danger">
                {t("cooldownInvalid")}
              </p>
            ) : null}
          </label>

          <label className="flex-1">
            <span className="mb-2 block text-sm font-bold text-fg-soft">{t("pointsLabel")}</span>
            <input
              className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
              type="number"
              min={1}
              max={100000}
              step={1}
              value={pointsInput}
              onChange={(event) => setPointsInput(event.target.value)}
            />
            <p className="mt-2 text-xs text-fg-muted">
              {t("pointsCurrent", { points: formatNumber(appSettings.pointsPerLog) })}
            </p>
            {!isPointsValid ? (
              <p className="mt-1 text-xs font-semibold text-danger">
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
              className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
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
              className="rounded-2xl border border-line/10 bg-panel px-5 py-3 font-black text-fg transition hover:bg-panel-strong disabled:opacity-60"
            >
              {t("actions.savePoints")}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("requestsEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("requestsTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {t("requestsDescription")}
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {registrationRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted lg:col-span-2">
              {t("requestsEmpty")}
            </div>
          ) : (
            registrationRequests.slice(0, 12).map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-fg">{request.email}</p>
                    <p className="text-xs text-fg-muted">{formatDateTime(request.createdAt)}</p>
                  </div>
                  <span className="rounded-full bg-panel px-2 py-1 text-xs font-black text-fg-soft">
                    {request.status === "pending" ? t("requestStatusPending") : t("requestStatusUsed")}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl bg-canvas-elevated/75 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-fg-muted">{t("requestCodeLabel")}</p>
                  <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-accent-strong">
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
          <p className="text-sm font-bold text-accent-strong">{t("attemptsEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("attemptsTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {t("attemptsDescription")}
          </p>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {registrationAttempts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
              {t("attemptsEmpty")}
            </div>
          ) : (
            registrationAttempts.slice(0, 50).map((attempt) => (
              <div
                key={attempt.id}
                className="grid gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-4 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${attemptClass(attempt.status)}`}>
                      {attemptLabel(attempt.status, (key) => t(key))}
                    </span>
                    <span className="text-xs text-fg-muted">{formatDateTime(attempt.createdAt)}</span>
                  </div>
                  <p className="mt-2 truncate font-black text-fg">{attempt.email}</p>
                  {attempt.message ? (
                    <p className="mt-1 text-sm text-fg-muted">{attempt.message}</p>
                  ) : null}
                </div>
                <div className="text-left md:text-right">
                  {attempt.approvalCodeProvided ? (
                    <>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-fg-muted">
                        {t("attemptCodeUsed")}
                      </p>
                      <p className="font-mono text-lg font-black tracking-[0.16em] text-accent-strong">
                        {attempt.approvalCodeProvided}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-fg-muted">{t("attemptWithoutCode")}</p>
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
            <p className="text-sm font-bold text-accent-strong">{t("manualEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">{t("manualTitle")}</h2>
          </div>
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.uid} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-3">
                <img src={user.avatar} alt="" className="h-10 w-10 rounded-full bg-accent-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-fg">{user.name}</p>
                  <p className="text-xs text-fg-muted">{t("userPoints", { points: formatNumber(user.totalPoints) })}</p>
                </div>
                <button
                  disabled={busy}
                  className="rounded-xl bg-panel px-3 py-2 font-black text-fg hover:bg-panel-subtle disabled:opacity-60"
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
                  className="rounded-xl bg-accent px-3 py-2 font-black text-accent-fg hover:bg-accent-strong disabled:opacity-60"
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
            <p className="text-sm font-bold text-accent-strong">{t("recentLogsEyebrow")}</p>
            <h2 className="text-2xl font-black text-fg">{t("recentLogsTitle")}</h2>
          </div>
          <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
            {logs.slice(0, 30).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent-soft/35 text-xl text-accent-strong">🧻</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-fg">
                    {resolveUserDisplayName(usersById, log.userId, log.userName)}
                  </p>
                  <p className="text-xs text-fg-muted">{formatDateTime(log.createdAt)}</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => runAdminAction(() => removeLog(admin, log), t("toast.removeLog"))}
                  className="rounded-xl bg-danger-soft/45 px-3 py-2 text-sm font-black text-danger hover:bg-danger-soft/65 disabled:opacity-60"
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
          <p className="text-sm font-bold text-accent-strong">{t("auditEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("auditTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {t("auditDescription")}
          </p>
        </div>

        <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
          {auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
              {t("auditEmpty")}
            </div>
          ) : (
            auditLogs.slice(0, 50).map((auditLog) => (
              <div
                key={auditLog.id}
                className="grid gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent-soft/35 px-2 py-1 text-xs font-black text-accent-strong">
                      {actionLabel(auditLog.action, (key) => t(key))}
                    </span>
                    <span className="text-xs text-fg-muted">{formatDateTime(auditLog.createdAt)}</span>
                  </div>
                  <p className="mt-2 font-black text-fg">
                    {formatAuditLogMessage(auditLog, usersById, t)}
                  </p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {t("auditAdmin")}:{" "}
                    <span className="text-fg-soft">
                      {resolveUserDisplayName(usersById, auditLog.adminId, auditLog.adminName)}
                    </span>
                    {auditLog.targetUserId ? (
                      <>
                        {" "}
                        • {t("auditTarget")}:{" "}
                        <span className="text-fg-soft">
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
                    <p className={auditLog.delta > 0 ? "font-black text-success" : "font-black text-danger"}>
                      {auditLog.delta > 0 ? "+" : ""}
                      {t("auditDelta", { count: Math.abs(auditLog.delta) })}
                    </p>
                  ) : null}
                  {typeof auditLog.points === "number" ? (
                    <p className="font-black text-danger">-{t("auditDelta", { count: auditLog.points })}</p>
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
