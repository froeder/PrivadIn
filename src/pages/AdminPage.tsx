import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AvatarImage } from "../components/AvatarImage";
import { Card } from "../components/Card";
import type {
  AdminAuditLog,
  AppSettings,
  AppUser,
  PoopLog,
  PoopcoinSupplySummary,
  PoopcoinTransaction,
  RegistrationAttempt,
  RankingGroup,
} from "../types";
import { adjustUserPoints, removeLog, resetWeeklyRanking } from "../services/poopService";
import {
  MAX_COMPETITION_ANNOUNCEMENT_LENGTH,
  MAX_TERMS_OF_USE_LENGTH,
  normalizeCompetitionAnnouncement,
  normalizePoopcoinRuleValue,
  normalizeTermsOfUseText,
  updateBonusTimeRanges,
  updateCompetitionAnnouncement,
  updateCooldownMinutes,
  updatePoopcoinRules,
  updatePointsPerLog,
  updateTermsOfUse,
} from "../services/settingsService";
import { deactivateUser, reactivateUser, setUserCooldown } from "../services/userService";
import { formatDateTime } from "../utils/date";
import { formatNumber } from "../utils/format";
import { toRoman } from "../utils/roman";
import {
  buildUsersById,
  formatAuditLogMessage,
  resolveUserDisplayName,
} from "../utils/auditLog";
import {
  adjustPoopcoins,
  formatPoopcoins,
  migratePoopcoinsForLogs,
  recalculatePoopcoinSupply,
  reversePoopcoinTransaction,
} from "../services/poopcoinService";
import { deleteGroup } from "../services/groupService";

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

function CollapsibleSection({
  eyebrow,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-3xl border border-line/10 bg-panel-strong/40" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-panel-subtle sm:px-6 sm:py-5">
        <div>
          <p className="text-sm font-bold text-accent-strong">{eyebrow}</p>
          <h2 className="text-xl font-black text-fg sm:text-2xl">{title}</h2>
          {description ? <p className="mt-1 text-sm text-fg-muted">{description}</p> : null}
        </div>
        <ChevronDown className="h-5 w-5 text-fg transition duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-line/10 px-5 py-4 sm:px-6 sm:py-5">
        {children}
      </div>
    </details>
  );
}

export function AdminPage({
  admin,
  users,
  logs,
  appSettings,
  auditLogs,
  registrationAttempts,
  groups,
  poopcoinTransactions,
  poopcoinSupply,
}: {
  admin: AppUser;
  users: AppUser[];
  logs: PoopLog[];
  appSettings: AppSettings;
  auditLogs: AdminAuditLog[];
  registrationAttempts: RegistrationAttempt[];
  groups: RankingGroup[];
  poopcoinTransactions: PoopcoinTransaction[];
  poopcoinSupply: PoopcoinSupplySummary;
}) {
  const { t } = useTranslation("admin");
  const [busy, setBusy] = useState(false);
  const [cooldownInput, setCooldownInput] = useState(String(appSettings.cooldownMinutes));
  const [pointsInput, setPointsInput] = useState(String(appSettings.pointsPerLog));
  const [poopcoinsPerLogInput, setPoopcoinsPerLogInput] = useState(String(appSettings.poopcoinsPerLog));
  const [cuiterPostCostInput, setCuiterPostCostInput] = useState(String(appSettings.cuiterPostCost));
  const [bonusRanges, setBonusRanges] = useState<{ start: string; end: string; points: number }[]>(
    (appSettings as any).bonusTimeRanges ?? [],
  );
  const [announcementInput, setAnnouncementInput] = useState(appSettings.competitionAnnouncement ?? "");
  const [termsInput, setTermsInput] = useState(appSettings.termsOfUseText ?? "");
  const [poopcoinAmounts, setPoopcoinAmounts] = useState<Record<string, string>>({});
  const [poopcoinReasons, setPoopcoinReasons] = useState<Record<string, string>>({});
  const [reverseHash, setReverseHash] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  useEffect(() => {
    setCooldownInput(String(appSettings.cooldownMinutes));
  }, [appSettings.cooldownMinutes]);

  useEffect(() => {
    setPointsInput(String(appSettings.pointsPerLog));
  }, [appSettings.pointsPerLog]);

  useEffect(() => {
    setPoopcoinsPerLogInput(String(appSettings.poopcoinsPerLog));
  }, [appSettings.poopcoinsPerLog]);

  useEffect(() => {
    setCuiterPostCostInput(String(appSettings.cuiterPostCost));
  }, [appSettings.cuiterPostCost]);

  useEffect(() => {
    setAnnouncementInput(appSettings.competitionAnnouncement ?? "");
  }, [appSettings.competitionAnnouncement]);

  useEffect(() => {
    setTermsInput(appSettings.termsOfUseText ?? "");
  }, [appSettings.termsOfUseText]);

  const parsedCooldown = Number(cooldownInput);
  const isCooldownValid =
    Number.isInteger(parsedCooldown) && parsedCooldown >= 1 && parsedCooldown <= 1440;
  const parsedPoints = Number(pointsInput);
  const isPointsValid =
    Number.isInteger(parsedPoints) && parsedPoints >= 1 && parsedPoints <= 100000;
  const parsedPoopcoinsPerLog = Number(poopcoinsPerLogInput);
  const parsedCuiterPostCost = Number(cuiterPostCostInput);
  const isPoopcoinsPerLogValid =
    Number.isInteger(parsedPoopcoinsPerLog) && parsedPoopcoinsPerLog >= 1 && parsedPoopcoinsPerLog <= 100000;
  const isCuiterPostCostValid =
    Number.isInteger(parsedCuiterPostCost) && parsedCuiterPostCost >= 1 && parsedCuiterPostCost <= 100000;
  const normalizedPoopcoinsPerLog = normalizePoopcoinRuleValue(parsedPoopcoinsPerLog, appSettings.poopcoinsPerLog);
  const normalizedCuiterPostCost = normalizePoopcoinRuleValue(parsedCuiterPostCost, appSettings.cuiterPostCost);
  const hasPoopcoinRuleChanges =
    normalizedPoopcoinsPerLog !== appSettings.poopcoinsPerLog ||
    normalizedCuiterPostCost !== appSettings.cuiterPostCost;
  const normalizedAnnouncement = normalizeCompetitionAnnouncement(announcementInput);
  const normalizedTerms = normalizeTermsOfUseText(termsInput);
  const usersById = useMemo(() => buildUsersById(users), [users]);

  async function runAdminAction(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function saveBonusRanges() {
    setBusy(true);
    try {
      await updateBonusTimeRanges(admin, bonusRanges);
      toast.success(t("toast.bonusSaved"));
    } catch (e) {
      console.error(e);
      toast.error(t("toast.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function setCooldownForUser(targetUid: string, minutes: number) {
    setBusy(true);
    try {
      await setUserCooldown(admin, targetUid, minutes);
      toast.success(t("toast.userCooldownSaved"));
    } catch (e) {
      console.error(e);
      toast.error(t("toast.genericError"));
    } finally {
      setBusy(false);
    }
  }

  async function runPoopcoinAdjustment(targetUser: AppUser) {
    const amount = Number(poopcoinAmounts[targetUser.uid] ?? 0);
    const reason = poopcoinReasons[targetUser.uid] ?? "";
    await runAdminAction(
      () => adjustPoopcoins(admin, targetUser, amount, reason),
      "Poopcoins ajustados.",
    );
    setPoopcoinAmounts((current) => ({ ...current, [targetUser.uid]: "" }));
    setPoopcoinReasons((current) => ({ ...current, [targetUser.uid]: "" }));
  }

  async function runPoopcoinMigration() {
    await runAdminAction(
      async () => {
        const migrated = await migratePoopcoinsForLogs(admin, logs);
        if (migrated === 0) {
          throw new Error("Nenhum log pendente.");
        }
      },
      "Lote de Poopcoins migrado.",
    );
  }

  async function runPoopcoinReversal() {
    await runAdminAction(
      () => reversePoopcoinTransaction(admin, reverseHash, reverseReason),
      "Transacao revertida.",
    );
    setReverseHash("");
    setReverseReason("");
  }

  async function savePoopcoinRules() {
    await runAdminAction(
      () => updatePoopcoinRules(admin, parsedPoopcoinsPerLog, parsedCuiterPostCost),
      "Regras PoopCoin salvas.",
    );
  }

  async function runDeleteGroup(group: RankingGroup) {
    const confirmed = window.confirm(`Excluir o grupo "${group.name}"? Esta acao remove o ranking privado para todos os membros.`);
    if (!confirmed) return;

    await runAdminAction(
      () => deleteGroup(admin, group),
      "Grupo excluido.",
    );
  }

  async function runPoopcoinSupplyRecalculation() {
    await runAdminAction(
      () => recalculatePoopcoinSupply(admin).then(() => undefined),
      "Suprimento PoopCoin recalculado.",
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="order-10">
        <CollapsibleSection
          eyebrow={t("heroEyebrow")}
          title={t("heroTitle")}
          description={t("heroDescription")}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mt-2 text-sm text-fg-soft">{t("common:labels.currentEdition", { edition: toRoman(appSettings.edition) })}</p>
            </div>
            <button
              disabled={busy}
              onClick={() => runAdminAction(() => resetWeeklyRanking(admin, logs, users, groups), t("toast.weeklyResetSuccess"))}
              className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
            >
              {t("actions.weeklyReset")}
            </button>
          </div>
        </CollapsibleSection>
      </Card>

      <Card className="order-20">
        <div className="mb-4">
          <p className="text-sm font-bold text-accent-strong">{t("announcementEyebrow")}</p>
          <h2 className="text-2xl font-black text-fg">{t("announcementTitle")}</h2>
          <p className="mt-1 text-sm text-fg-muted">{t("announcementDescription")}</p>
        </div>

        <label className="block">
          <textarea
            className="min-h-28 w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
            maxLength={MAX_COMPETITION_ANNOUNCEMENT_LENGTH}
            value={announcementInput}
            onChange={(event) => setAnnouncementInput(event.target.value)}
            placeholder={t("announcementPlaceholder")}
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">
            {t("announcementCounter", {
              count: normalizedAnnouncement.length,
              max: MAX_COMPETITION_ANNOUNCEMENT_LENGTH,
            })}
          </p>
          <button
            disabled={busy || normalizedAnnouncement === (appSettings.competitionAnnouncement ?? "")}
            onClick={() =>
              runAdminAction(
                () => updateCompetitionAnnouncement(admin, announcementInput),
                t("toast.announcementSaved"),
              )
            }
            className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
          >
            {t("actions.saveAnnouncement")}
          </button>
        </div>
      </Card>

      <Card className="order-30">
        <CollapsibleSection
          eyebrow={t("settingsEyebrow")}
          title={t("settingsTitle")}
          description={t("settingsDescription")}
        >
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

        <div className="mt-6">
          <h3 className="text-sm font-bold text-fg-soft">Bonus time ranges</h3>
          <p className="mt-1 text-sm text-fg-muted">Defina períodos com pontuação diferente (HH:MM).</p>
          <div className="mt-3 space-y-3">
            {bonusRanges.map((r, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="min-w-0 rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none"
                  value={r.start}
                  onChange={(e) => setBonusRanges((cur) => cur.map((v, i) => i === idx ? { ...v, start: e.target.value } : v))}
                />
                <input
                  className="min-w-0 rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none"
                  value={r.end}
                  onChange={(e) => setBonusRanges((cur) => cur.map((v, i) => i === idx ? { ...v, end: e.target.value } : v))}
                />
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none sm:w-24"
                    value={String(r.points)}
                    onChange={(e) => setBonusRanges((cur) => cur.map((v, i) => i === idx ? { ...v, points: Number(e.target.value) } : v))}
                  />
                  <button
                    className="rounded-xl bg-danger-soft/45 px-3 py-2 text-sm font-black text-danger"
                    onClick={() => setBonusRanges((cur) => cur.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-2xl bg-accent px-4 py-2 font-black text-accent-fg" onClick={() => setBonusRanges((cur) => [...cur, { start: "09:00", end: "10:00", points: appSettings.pointsPerLog }])}>
                Add range
              </button>
              <button disabled={busy} className="rounded-2xl border border-line/10 bg-panel px-4 py-2 font-black text-fg" onClick={() => void saveBonusRanges()}>
                Save ranges
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold text-fg-soft">{t("termsTitle")}</h3>
          <p className="mt-1 text-sm text-fg-muted">
            {t("termsDescription", { version: appSettings.termsOfUseVersion ?? 1 })}
          </p>
          <label className="mt-3 block">
            <textarea
              className="min-h-40 w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
              maxLength={MAX_TERMS_OF_USE_LENGTH}
              value={termsInput}
              onChange={(event) => setTermsInput(event.target.value)}
              placeholder={t("termsPlaceholder")}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              {t("termsCounter", {
                count: normalizedTerms.length,
                max: MAX_TERMS_OF_USE_LENGTH,
              })}
            </p>
            <button
              disabled={busy || normalizedTerms === normalizeTermsOfUseText(appSettings.termsOfUseText ?? "")}
              onClick={() =>
                runAdminAction(
                  () => updateTermsOfUse(admin, termsInput),
                  t("toast.termsSaved", { version: (appSettings.termsOfUseVersion ?? 1) + 1 }),
                )
              }
              className="rounded-2xl border border-line/10 bg-panel px-5 py-3 font-black text-fg transition hover:bg-panel-strong disabled:opacity-60"
            >
              {t("actions.saveTerms")}
            </button>
          </div>
        </div>
        </CollapsibleSection>
      </Card>

      <Card className="order-60">
        <CollapsibleSection
          eyebrow="Grupos"
          title="Grupos criados"
          description="O admin do sistema pode acompanhar e excluir grupos."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted lg:col-span-2">
                Nenhum grupo criado ainda.
              </div>
            ) : (
              groups.map((group) => {
                const owner = usersById.get(group.ownerId);
                return (
                  <div
                    key={group.id}
                    className="grid gap-4 rounded-2xl border border-line/10 bg-panel-strong/40 p-4 sm:grid-cols-[1fr_auto] sm:items-start"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-black text-fg">{group.name}</p>
                        <span className="rounded-full bg-panel px-2 py-1 text-xs font-black text-fg-soft">
                          {group.memberCount} membro(s)
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-fg-muted">{group.description || "Sem descricao."}</p>
                      <p className="mt-2 text-xs text-fg-muted">
                        ID <span className="font-mono text-accent-strong">{group.id}</span> · admin{" "}
                        <span className="text-fg-soft">{owner?.name ?? group.ownerId}</span> · {formatDateTime(group.createdAt)}
                      </p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => void runDeleteGroup(group)}
                      className="rounded-xl bg-danger-soft/45 px-3 py-2 text-sm font-black text-danger transition hover:bg-danger-soft/65 disabled:opacity-60"
                    >
                      Excluir
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleSection>
      </Card>

      <Card className="order-70">
        <CollapsibleSection
          eyebrow={t("attemptsEyebrow")}
          title={t("attemptsTitle")}
          description={t("attemptsDescription")}
        >
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
                    {attempt.groupCodeProvided || attempt.approvalCodeProvided ? (
                      <>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-fg-muted">
                          {t("attemptCodeUsed")}
                        </p>
                        <p className="font-mono text-lg font-black tracking-[0.16em] text-accent-strong">
                          {attempt.groupCodeProvided ?? attempt.approvalCodeProvided}
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
        </CollapsibleSection>
      </Card>

      <section className="contents">
        <Card className="order-50">
          <CollapsibleSection
            eyebrow={t("manualEyebrow")}
            title={t("manualTitle")}
          >
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.uid} className="grid gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarImage avatar={user.avatar} email={user.email} name={user.name} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate font-black text-fg">{user.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${user.isActive === false ? "bg-danger-soft/45 text-danger" : "bg-success-soft/45 text-success"}`}>
                        {user.isActive === false ? t("userInactive") : t("userActive")}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted">
                      {t("userPoints", { points: formatNumber(user.totalPoints) })} · {formatPoopcoins(user.poopcoinBalance)} PC
                    </p>
                  </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:flex lg:flex-wrap lg:items-center lg:justify-end">
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
                      className="min-w-0 rounded-xl bg-accent px-3 py-2 text-sm font-black text-accent-fg hover:bg-accent-strong disabled:opacity-60"
                      onClick={() =>
                        runAdminAction(
                          () => adjustUserPoints(admin, user, appSettings.pointsPerLog),
                          t("toast.addPoints", { points: formatNumber(appSettings.pointsPerLog) }),
                        )
                      }
                    >
                      +{formatNumber(appSettings.pointsPerLog)}
                    </button>
                    <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:col-span-2 lg:flex">
                      <input type="number" min={0} placeholder="Cooldown min" className="min-w-0 rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none lg:w-28" id={`cooldown-${user.uid}`} />
                      <button className="shrink-0 rounded-xl bg-panel px-3 py-2 text-sm font-black text-fg" onClick={() => {
                        const el = document.getElementById(`cooldown-${user.uid}`) as HTMLInputElement | null;
                        const val = el?.value ? Number(el.value) : 0;
                        if (Number.isFinite(val) && val >= 0) void setCooldownForUser(user.uid, val);
                      }}>Set cooldown</button>
                    </div>
                    <button
                      disabled={busy || admin.uid === user.uid}
                      className={`col-span-2 min-w-0 rounded-xl px-3 py-2 text-sm font-black disabled:opacity-60 sm:col-span-1 ${
                        user.isActive === false
                          ? "bg-success-soft/45 text-success hover:bg-success-soft/65"
                          : "bg-danger-soft/45 text-danger hover:bg-danger-soft/65"
                      }`}
                      onClick={() => {
                        const confirmed = window.confirm(
                          user.isActive === false
                            ? t("reactivateConfirm", { name: user.name })
                            : t("deactivateConfirm", { name: user.name }),
                        );
                        if (!confirmed) return;

                        void runAdminAction(
                          () => (user.isActive === false ? reactivateUser(admin, user) : deactivateUser(admin, user)),
                          user.isActive === false ? t("toast.userReactivated") : t("toast.userDeactivated"),
                        );
                      }}
                    >
                      {user.isActive === false ? t("actions.reactivateUser") : t("actions.deactivateUser")}
                    </button>
                    <input
                      type="number"
                      step={1}
                      placeholder="+/- PC"
                      className="min-w-0 rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none lg:w-24"
                      value={poopcoinAmounts[user.uid] ?? ""}
                      onChange={(event) =>
                        setPoopcoinAmounts((current) => ({ ...current, [user.uid]: event.target.value }))
                      }
                    />
                    <input
                      type="text"
                      placeholder="Motivo"
                      className="min-w-0 rounded-2xl border border-line/10 bg-field px-3 py-2 text-fg outline-none lg:w-40"
                      value={poopcoinReasons[user.uid] ?? ""}
                      onChange={(event) =>
                        setPoopcoinReasons((current) => ({ ...current, [user.uid]: event.target.value }))
                      }
                    />
                    <button
                      disabled={
                        busy ||
                        !Number.isInteger(Number(poopcoinAmounts[user.uid])) ||
                        Number(poopcoinAmounts[user.uid]) === 0 ||
                        !poopcoinReasons[user.uid]?.trim()
                      }
                      className="min-w-0 rounded-xl bg-panel px-3 py-2 text-sm font-black text-fg hover:bg-panel-subtle disabled:opacity-60"
                      onClick={() => void runPoopcoinAdjustment(user)}
                    >
                      Ajustar PC
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </Card>

        <Card className="order-80">
          <CollapsibleSection
            eyebrow={t("recentLogsEyebrow")}
            title={t("recentLogsTitle")}
          >
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
          </CollapsibleSection>
        </Card>
      </section>

      <Card className="order-40">
        <CollapsibleSection
          eyebrow="Poopcoins"
          title="PoopCoins e Cuiter"
          description="Controle emissao limitada, custo do Cuiter, reversoes e auditoria do ledger."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-muted">Oferta total</p>
              <p className="mt-2 text-2xl font-black text-fg">{formatPoopcoins(poopcoinSupply.totalSupply)} PC</p>
            </div>
            <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-muted">Emitidas</p>
              <p className="mt-2 text-2xl font-black text-fg">{formatPoopcoins(poopcoinSupply.mintedSupply)} PC</p>
            </div>
            <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-muted">Queimadas</p>
              <p className="mt-2 text-2xl font-black text-fg">{formatPoopcoins(poopcoinSupply.burnedSupply)} PC</p>
            </div>
            <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-muted">Disponiveis</p>
              <p className="mt-2 text-2xl font-black text-fg">{formatPoopcoins(poopcoinSupply.availableSupply)} PC</p>
              <p className="mt-1 text-xs text-fg-muted">
                {poopcoinSupply.supplyMigratedAt ? "Pronto para emitir" : "Recalculo pendente"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-sm font-bold text-fg-soft">PoopCoins por registro</span>
              <input
                className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                type="number"
                min={1}
                max={100000}
                step={1}
                value={poopcoinsPerLogInput}
                onChange={(event) => setPoopcoinsPerLogInput(event.target.value)}
              />
              {!isPoopcoinsPerLogValid ? (
                <p className="mt-1 text-xs font-semibold text-danger">Informe um inteiro entre 1 e 100000.</p>
              ) : null}
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-fg-soft">Custo do post no Cuiter</span>
              <input
                className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                type="number"
                min={1}
                max={100000}
                step={1}
                value={cuiterPostCostInput}
                onChange={(event) => setCuiterPostCostInput(event.target.value)}
              />
              {!isCuiterPostCostValid ? (
                <p className="mt-1 text-xs font-semibold text-danger">Informe um inteiro entre 1 e 100000.</p>
              ) : null}
            </label>
            <button
              disabled={busy || !isPoopcoinsPerLogValid || !isCuiterPostCostValid || !hasPoopcoinRuleChanges}
              onClick={() => void savePoopcoinRules()}
              className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
            >
              Salvar regras
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              onClick={() => void runPoopcoinSupplyRecalculation()}
              className="rounded-2xl border border-line/10 bg-panel px-5 py-3 font-black text-fg transition hover:bg-panel-strong disabled:opacity-60"
            >
              Recalcular suprimento
            </button>
            <p className="text-sm text-fg-muted">
              Inicializa ou corrige os totais a partir do saldo atual das carteiras.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-sm font-bold text-fg-soft">Hash para reverter</span>
              <input
                className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 font-mono text-sm text-fg outline-none"
                value={reverseHash}
                onChange={(event) => setReverseHash(event.target.value)}
                placeholder="Cole o hash da transacao"
              />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-fg-soft">Motivo da reversao</span>
              <input
                className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                value={reverseReason}
                onChange={(event) => setReverseReason(event.target.value)}
                placeholder="Fraude comprovada, erro operacional..."
              />
            </label>
            <button
              disabled={busy || !reverseHash.trim() || !reverseReason.trim()}
              onClick={() => void runPoopcoinReversal()}
              className="rounded-2xl bg-danger-soft/55 px-5 py-3 font-black text-danger transition hover:bg-danger-soft/75 disabled:opacity-60"
            >
              Reverter
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              onClick={() => void runPoopcoinMigration()}
              className="rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
            >
              Migrar ate 25 logs antigos
            </button>
            <p className="text-sm text-fg-muted">
              Regra atual: {formatPoopcoins(appSettings.poopcoinsPerLog)} PC por log antigo. Pendentes neste
              carregamento: {logs.filter((log) => !log.poopcoinTransactionHash && log.poopcoinsEarned == null).length}
            </p>
          </div>

          <div className="mt-5 max-h-[420px] space-y-3 overflow-auto pr-1">
            {poopcoinTransactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
                Nenhuma transacao Poopcoin registrada ainda.
              </div>
            ) : (
              poopcoinTransactions.slice(0, 30).map((transaction) => (
                <div
                  key={transaction.hash}
                  className="grid gap-3 rounded-2xl border border-line/10 bg-panel-strong/40 p-4 md:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-accent-soft/35 px-2 py-1 text-xs font-black text-accent-strong">
                        #{transaction.sequence}
                      </span>
                      <span className="rounded-full bg-panel px-2 py-1 text-xs font-black text-fg-soft">
                        {transaction.type}
                      </span>
                      {transaction.status === "reversed" ? (
                        <span className="rounded-full bg-danger-soft/45 px-2 py-1 text-xs font-black text-danger">
                          Revertida
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate font-mono text-xs text-fg-muted" title={transaction.hash}>
                      {transaction.hash}
                    </p>
                    {transaction.reason ? (
                      <p className="mt-1 text-sm text-fg-muted">{transaction.reason}</p>
                    ) : null}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-black text-accent-strong">{formatPoopcoins(transaction.amount)} PC</p>
                    <p className="text-xs text-fg-muted">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleSection>
      </Card>

      <Card className="order-90">
        <CollapsibleSection
          eyebrow={t("auditEyebrow")}
          title={t("auditTitle")}
          description={t("auditDescription")}
        >
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
        </CollapsibleSection>
      </Card>
    </div>
  );
}
