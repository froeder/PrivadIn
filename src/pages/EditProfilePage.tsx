import { useState } from "react";
import toast from "react-hot-toast";
import { Card } from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import { avatarFor } from "../utils/ranking";
import { updateUserProfile } from "../services/userService";

export function EditProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const currentUser = user;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await updateUserProfile(currentUser.uid, { name: name.trim(), avatar: avatar.trim() });
      toast.success("Perfil atualizado.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao atualizar perfil. Verifique permissoes e conexao.");
    } finally {
      setBusy(false);
    }
  }

  function handleGenerateAvatar() {
    setAvatar(avatarFor(name || currentUser.name, currentUser.email));
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4">
          <p className="text-sm font-bold text-yellow-100">Editar perfil</p>
          <h2 className="text-2xl font-black text-white">Seu nome e foto</h2>
          <p className="mt-1 text-sm text-slate-400">Atualize como aparece no ranking.</p>
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
            <span className="mb-2 block text-sm font-bold text-slate-300">Foto (URL)</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
              />
              <button
                type="button"
                className="rounded-2xl bg-yellow-300 px-4 py-3 font-black text-slate-950 hover:bg-yellow-200"
                onClick={handleGenerateAvatar}
              >
                Gerar
              </button>
            </div>
          </label>

          <div className="flex items-center gap-4">
            <img src={avatar || avatarFor(name || currentUser.name, currentUser.email)} alt="avatar" className="h-16 w-16 rounded-full" />
            <div className="flex-1">
              <p className="font-black text-white">Preview</p>
              <p className="text-sm text-slate-400">Como seu avatar aparecerá no app</p>
            </div>
            <button
              disabled={busy}
              className="rounded-2xl bg-yellow-300 px-5 py-3 font-black text-slate-950 hover:bg-yellow-200 disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
