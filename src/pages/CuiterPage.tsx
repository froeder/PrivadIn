import { useEffect, useMemo, useState } from "react";
import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import toast from "react-hot-toast";
import { MessageCircle, Send } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { Card } from "../components/Card";
import {
  CUITER_MAX_CHARS,
  CUITER_CREDIT_START_DATE,
  canPostOnCuiter,
  countUserCuiterPosts,
  createCuiterPost,
  fetchCuiterPostsPage,
  getCuiterAvailableCredits,
  isCuiterCreditEligibleLog,
} from "../services/cuiterService";
import type { AppUser, CuiterPost, PoopLog } from "../types";
import { formatDateTime, formatTimeAgo, toDate } from "../utils/date";

export function CuiterPage({
  user,
  userLogs,
}: {
  user: AppUser;
  userLogs: PoopLog[];
}) {
  const { t } = useTranslation("cuiter");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [posts, setPosts] = useState<CuiterPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [userPostsCount, setUserPostsCount] = useState(0);
  const charsCount = [...message].length;
  const charsRemaining = CUITER_MAX_CHARS - charsCount;
  const eligibleLogsCount = userLogs.filter((log) => {
    const createdAtMs = toDate(log.createdAt)?.getTime();
    return typeof createdAtMs === "number" ? isCuiterCreditEligibleLog(createdAtMs) : false;
  }).length;
  const availableCredits = getCuiterAvailableCredits(eligibleLogsCount, userPostsCount);
  const unlocked = canPostOnCuiter(user, eligibleLogsCount, userPostsCount);
  const canPublish = unlocked && !sending && charsCount > 0 && charsCount <= CUITER_MAX_CHARS;

  function isFirestorePermissionDenied(error: unknown): error is FirebaseError {
    return error instanceof FirebaseError && error.code === "permission-denied";
  }

  const orderedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      }),
    [posts],
  );

  async function loadInitial() {
    setLoadingFeed(true);
    try {
      const page = await fetchCuiterPostsPage(null);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);

      try {
        const myPostsCount = await countUserCuiterPosts(user.uid);
        setUserPostsCount(myPostsCount);
      } catch {
        setUserPostsCount(0);
        toast.error(t("loadUserPostsError"));
      }
    } catch {
      toast.error(t("loadFeedError"));
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => {
    void loadInitial();
  }, [user.uid]);

  async function handleLoadMore() {
    if (!hasMore || loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchCuiterPostsPage(cursor);
      setPosts((current) => [...current, ...page.posts]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      toast.error(t("loadMoreError"));
    } finally {
      setLoadingMore(false);
    }
  }

  async function handlePublish() {
    if (!canPublish) return;
    setSending(true);
    try {
      const post = await createCuiterPost(user, message, eligibleLogsCount, userPostsCount);
      setPosts((current) => [post, ...current]);
      setUserPostsCount((current) => current + 1);
      setMessage("");
      toast.success(t("publishSuccess"));
    } catch (error) {
      if (isFirestorePermissionDenied(error)) {
        toast.error(t("permissionDenied"));
      } else {
        toast.error(error instanceof Error ? error.message : t("publishError"));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-yellow-100">{t("eyebrow")}</p>
            <h2 className="text-2xl font-black text-white">{t("title")}</h2>
          </div>
          <MessageCircle className="text-yellow-200" />
        </div>

        <div className="space-y-3">
          {!unlocked ? (
            <div className="rounded-2xl border border-yellow-200/25 bg-yellow-300/10 p-3 text-sm text-yellow-100">
              <Trans
                i18nKey="cuiter:unlockInfo"
                values={{ date: formatDateTime(Timestamp.fromDate(CUITER_CREDIT_START_DATE)) }}
                components={{ strong: <strong /> }}
              />
            </div>
          ) : null}

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={CUITER_MAX_CHARS}
            placeholder={t("placeholder")}
            className="min-h-24 w-full resize-none rounded-2xl border border-white/15 bg-slate-900/60 p-3 text-sm text-white outline-none ring-yellow-300/40 transition focus:ring"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-bold ${charsRemaining < 20 ? "text-amber-300" : "text-slate-400"}`}>
              {t("credits", { chars: charsRemaining, count: availableCredits })}
            </span>
            <button
              onClick={handlePublish}
              disabled={!canPublish}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={15} />
              {sending ? t("publishLoading") : t("publishAction")}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">{t("feedEyebrow")}</p>
          <h2 className="text-2xl font-black text-white">{t("feedTitle")}</h2>
        </div>
        <div className="space-y-3">
          {loadingFeed ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              {t("feedLoading")}
            </div>
          ) : orderedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              {t("feedEmpty")}
            </div>
          ) : (
            orderedPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-white">
                    {post.userName}
                  </p>
                  <p className="shrink-0 text-xs text-slate-400">{formatTimeAgo(post.createdAt)}</p>
                </div>
                <p className="text-sm text-slate-200">{post.message}</p>
              </article>
            ))
          )}
        </div>
        {hasMore && !loadingFeed ? (
          <div className="mt-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20 disabled:opacity-60"
            >
              {loadingMore ? t("loadMoreLoading") : t("loadMoreAction")}
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
