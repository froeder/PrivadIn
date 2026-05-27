import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { MessageCircle, Send } from "lucide-react";
import { Card } from "../components/Card";
import { CUITER_MAX_CHARS, canPostOnCuiter, createCuiterPost } from "../services/cuiterService";
import type { AppUser, CuiterPost } from "../types";
import { formatTimeAgo } from "../utils/date";

export function CuiterPage({ user, posts }: { user: AppUser; posts: CuiterPost[] }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const unlocked = canPostOnCuiter(user);
  const charsCount = [...message].length;
  const charsRemaining = CUITER_MAX_CHARS - charsCount;
  const canPublish = unlocked && !sending && charsCount > 0 && charsCount <= CUITER_MAX_CHARS;

  const orderedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      }),
    [posts],
  );

  async function handlePublish() {
    if (!canPublish) return;
    setSending(true);
    try {
      await createCuiterPost(user, message);
      setMessage("");
      toast.success("Postado no Cuiter.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel publicar agora.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-yellow-100">Mini rede social</p>
            <h2 className="text-2xl font-black text-white">Cuiter</h2>
          </div>
          <MessageCircle className="text-yellow-200" />
        </div>

        <div className="space-y-3">
          {!unlocked ? (
            <div className="rounded-2xl border border-yellow-200/25 bg-yellow-300/10 p-3 text-sm text-yellow-100">
              Para publicar no Cuiter, clique antes em <strong>Registrar cagada</strong> pelo menos uma vez.
            </div>
          ) : null}

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={CUITER_MAX_CHARS}
            placeholder="Compartilhe sua frase curta..."
            className="min-h-24 w-full resize-none rounded-2xl border border-white/15 bg-slate-900/60 p-3 text-sm text-white outline-none ring-yellow-300/40 transition focus:ring"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-bold ${charsRemaining < 20 ? "text-amber-300" : "text-slate-400"}`}>
              {charsRemaining} caracteres restantes
            </span>
            <button
              onClick={handlePublish}
              disabled={!canPublish}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={15} />
              {sending ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Feed ao vivo</p>
          <h2 className="text-2xl font-black text-white">Frases da firma</h2>
        </div>
        <div className="space-y-3">
          {orderedPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400">
              Ainda nao ha posts no Cuiter.
            </div>
          ) : (
            orderedPosts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-white">{post.userName}</p>
                  <p className="shrink-0 text-xs text-slate-400">{formatTimeAgo(post.createdAt)}</p>
                </div>
                <p className="text-sm text-slate-200">{post.message}</p>
              </article>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
