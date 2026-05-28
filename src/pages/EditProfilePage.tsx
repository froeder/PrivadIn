import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import { avatarFor, canLoadDicebearUrl, isValidDicebearUrl } from "../utils/ranking";
import { updateUserProfile } from "../services/userService";

type AvatarStatus = "idle" | "checking" | "valid" | "invalid";

export function EditProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? avatarFor(user?.name ?? "", user?.email ?? ""));
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus>(
    isValidDicebearUrl(user?.avatar ?? "") ? "valid" : "idle",
  );
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const currentUser = user;
  const hasValidAvatar = isValidDicebearUrl(avatar);
  const previewAvatar = avatarStatus === "valid" && hasValidAvatar
    ? avatar.trim()
    : currentUser.avatar || avatarFor(currentUser.name, currentUser.email);

  async function validateAvatar(showToast = false) {
    const candidate = avatar.trim();

    if (!isValidDicebearUrl(candidate)) {
      setAvatarStatus("invalid");
      if (showToast) {
        toast.error('Use uma URL valida da DiceBear iniciada com "https://api.dicebear.com/".');
      }
      return false;
    }

    setAvatarStatus("checking");
    const canLoad = await canLoadDicebearUrl(candidate);

    if (avatar.trim() !== candidate) {
      return false;
    }

    setAvatarStatus(canLoad ? "valid" : "invalid");

    if (!canLoad && showToast) {
      toast.error("Não consegui carregar esse avatar da DiceBear. Confira o link escolhido.");
    }

    return canLoad;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!(await validateAvatar(true))) {
      return;
    }

    setBusy(true);
    try {
      await updateUserProfile(currentUser.uid, {
        name: name.trim(),
        nickname: nickname.trim(),
        avatar: avatar.trim(),
      });
      toast.success("Perfil atualizado.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao atualizar perfil. Verifique permissões e conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Editar perfil</p>
          <h2 className="text-2xl font-black text-white">Seu nome e apelido</h2>
          <p className="mt-1 text-sm text-slate-400">O apelido aparece abaixo do seu nome nos rankings geral e semanal.</p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">Nome</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">Apelido</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Opcional para os rankings"
              maxLength={35}
            />
            <p className="mt-2 text-xs text-slate-500">{nickname.length}/35 caracteres</p>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-300">Avatar DiceBear</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
              type="url"
              value={avatar}
              onChange={(e) => {
                const nextValue = e.target.value;
                setAvatar(nextValue);
                setAvatarStatus(
                  isValidDicebearUrl(nextValue)
                    ? nextValue.trim() === (currentUser.avatar ?? "").trim()
                      ? "valid"
                      : "idle"
                    : "invalid",
                );
              }}
              onBlur={() => {
                if (isValidDicebearUrl(avatar)) {
                  void validateAvatar();
                }
              }}
              placeholder="https://api.dicebear.com/9.x/croodles/svg?seed=Liliana"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Cole um link de avatar iniciado com "https://api.dicebear.com/". Para escolher o seu, acesse
              {" "}
              <a
                className="font-semibold text-yellow-100 underline underline-offset-2"
                href="https://www.dicebear.com/playground/"
                target="_blank"
                rel="noreferrer"
              >
                https://www.dicebear.com/playground/
              </a>
              .
            </p>
            {!hasValidAvatar ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                Informe uma URL valida da DiceBear.
              </p>
            ) : avatarStatus === "checking" ? (
              <p className="mt-1 text-xs font-semibold text-sky-200">
                Validando se a imagem da DiceBear responde...
              </p>
            ) : avatarStatus === "valid" ? (
              <p className="mt-1 text-xs font-semibold text-emerald-300">
                Link validado com sucesso.
              </p>
            ) : avatarStatus === "invalid" ? (
              <p className="mt-1 text-xs font-semibold text-red-300">
                Não consegui carregar uma imagem valida nessa URL.
              </p>
            ) : null}
          </label>

          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img src={previewAvatar} alt="avatar" className="h-16 w-16 rounded-full" />
            <div className="w-full flex-1">
              <p className="font-black text-white">Avatar atual</p>
              <p className="text-sm text-slate-400">Cole um link da DiceBear para trocar a imagem.</p>
            </div>
            <button
              disabled={busy || !hasValidAvatar}
              className="w-full rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60 sm:w-auto"
            >
              Salvar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
