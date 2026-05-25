import { useState, type FormEvent } from "react";
import { KeyRound, Lock, Mail, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { isFirebaseConfigured } from "../services/firebase";
import { AuthLoginError, loginErrorMessage } from "../utils/authErrors";

export function LoginPage({ cooldownMinutes }: { cooldownMinutes: number }) {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const emailForLogin = needsCode ? requestedEmail || email : email;

    try {
      const result = await login(
        emailForLogin,
        password,
        needsCode ? approvalCode : undefined,
      );
      if (result.status === "access_code_required") {
        setNeedsCode(true);
        setRequestedEmail(result.request.email);
        setEmail(result.request.email);
        toast.success("Pedido criado. Peça o codigo para um admin do PrivadIn.");
        return;
      }

      toast.success(
        needsCode
          ? "Cadastro liberado. Bem-vindo ao campeonato."
          : "Entrada autorizada. O trono reconheceu sua presença.",
      );
    } catch (error) {
      console.error(error);
      if (error instanceof AuthLoginError) {
        toast.error(loginErrorMessage(error.code, needsCode));
        return;
      }
      toast.error(
        isFirebaseConfigured
          ? needsCode
            ? "Nao foi possivel validar o codigo. Confira email, senha e codigo com o admin."
            : "Nao achei acesso ativo. Vou preparar uma solicitacao de codigo."
          : "Configure o .env com as credenciais Firebase antes de entrar.",
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(45,212,191,0.14),transparent_26%),linear-gradient(135deg,#020617,#111827_55%,#1f2937)]" />
      <main className="relative mx-auto grid min-h-screen max-w-6xl place-items-center px-4 py-10">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1fr_440px]">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200/20 bg-yellow-300/10 px-4 py-2 text-sm font-bold text-yellow-100">
              <Sparkles size={16} />
              Competicao sanitaria corporativa
            </div>
            <div>
              <h1 className="max-w-3xl text-5xl font-black leading-none text-white sm:text-7xl">
                PrivadIn
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-slate-300 sm:text-xl">
                Registre seus momentos de produtividade paralela, dispute o ranking dos amigos e transforme o expediente em esporte de alto rendimento.
              </p>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                "Ranking em tempo real",
                "Streaks e conquistas",
                `Anti-fraude ${cooldownMinutes} min`,
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm font-bold text-slate-200 backdrop-blur-xl">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="mb-6 text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-yellow-300 text-5xl shadow-xl shadow-yellow-400/20">
                🚽
              </div>
              <h2 className="mt-4 text-2xl font-black text-white">Bater ponto no banheiro</h2>
              <p className="mt-1 text-sm text-slate-400">
                Entre normalmente ou solicite um codigo individual ao admin.
              </p>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">Email</span>
              <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <Mail className="text-yellow-200" size={18} />
                <input
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:text-slate-400"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@empresa.com"
                  readOnly={needsCode && Boolean(requestedEmail)}
                  required
                />
              </span>
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-bold text-slate-300">Senha</span>
              <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                <Lock className="text-yellow-200" size={18} />
                <input
                  className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={needsCode ? "crie uma senha (nao e o codigo)" : "senha secreta do trono"}
                  required
                />
              </span>
            </label>

            {needsCode ? (
              <div className="mb-6 rounded-2xl border border-yellow-200/30 bg-yellow-300/10 p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-yellow-300 text-slate-950">
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <p className="font-black text-yellow-100">Acesso aguardando codigo</p>
                    <p className="mt-1 text-sm text-slate-300">
                      Peça ao admin o codigo exibido para{" "}
                      <span className="font-bold text-white">{requestedEmail || email}</span>.
                    </p>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-300">Codigo do admin</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-yellow-200/20 bg-slate-950/70 px-4 py-3">
                    <KeyRound className="text-yellow-200" size={18} />
                    <input
                      className="w-full bg-transparent font-mono tracking-[0.18em] text-white outline-none placeholder:tracking-normal placeholder:text-slate-500"
                      type="text"
                      value={approvalCode}
                      onChange={(event) => setApprovalCode(event.target.value.toUpperCase())}
                      placeholder="ABC123"
                      required={needsCode}
                      maxLength={6}
                      autoFocus
                    />
                  </span>
                </label>
              </div>
            ) : null}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-yellow-300 px-5 py-4 text-base font-black text-slate-950 shadow-lg shadow-yellow-300/20 transition hover:-translate-y-0.5 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Consultando a descarga..."
                : needsCode
                  ? "VALIDAR CODIGO E ENTRAR"
                  : "ENTRAR OU SOLICITAR ACESSO"}
            </button>
            {needsCode ? (
              <button
                type="button"
                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setNeedsCode(false);
                  setApprovalCode("");
                  setRequestedEmail("");
                }}
              >
                Voltar para login normal
              </button>
            ) : (
              <button
                type="button"
                className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setNeedsCode(true);
                  setRequestedEmail(email.trim());
                  setApprovalCode("");
                  toast(
                    "Use o codigo do admin no campo abaixo. A senha e a que voce escolher — nao o codigo.",
                    { icon: "🔑" },
                  );
                }}
              >
                Ja tenho codigo
              </button>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
              {isFirebaseConfigured
                ? "Sem codigo de admin, sem campeonato. Democracia, mas com portaria."
                : "Copie .env.example para .env e preencha as chaves do Firebase."}
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
