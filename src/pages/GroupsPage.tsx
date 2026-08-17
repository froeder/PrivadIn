import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Copy, Loader2, Save, UserMinus, Users } from "lucide-react";
import { Card } from "../components/Card";
import { RankingList } from "../components/RankingList";
import type { AppUser, PoopLog, RankingGroup } from "../types";
import { rankUsers } from "../utils/ranking";
import { formatDateTime } from "../utils/date";
import { toRoman } from "../utils/roman";
import {
  GROUP_DESCRIPTION_MAX_LENGTH,
  GROUP_NAME_MAX_LENGTH,
  createGroup,
  joinGroup,
  normalizeGroupDescription,
  normalizeGroupName,
  removeGroupMember,
  updateGroup,
} from "../services/groupService";

export function GroupsPage({
  user,
  users,
  logs,
  groups,
  onViewProfile,
}: {
  user: AppUser;
  users: AppUser[];
  logs: PoopLog[];
  groups: RankingGroup[];
  onViewProfile: (uid: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editing, setEditing] = useState<Record<string, { name: string; description: string }>>({});

  const activeGroups = useMemo(() => groups.filter((group) => !group.deletedAt), [groups]);
  const myGroups = useMemo(
    () => activeGroups.filter((group) => group.memberIds.includes(user.uid)),
    [activeGroups, user.uid],
  );
  const ownedGroup = useMemo(
    () => activeGroups.find((group) => group.ownerId === user.uid) ?? null,
    [activeGroups, user.uid],
  );
  const usersById = useMemo(() => new Map(users.map((candidate) => [candidate.uid, candidate])), [users]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel concluir a acao.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    const name = normalizeGroupName(newName);
    const description = normalizeGroupDescription(newDescription);

    await run(async () => {
      await createGroup(user, name, description);
      setNewName("");
      setNewDescription("");
    }, "Grupo criado. Compartilhe o ID com quem deve entrar.");
  }

  async function handleJoinGroup() {
    const code = joinCode.trim().toUpperCase();
    await run(async () => {
      await joinGroup(user, code);
      setJoinCode("");
    }, "Voce entrou no grupo.");
  }

  async function copyGroupId(groupId: string) {
    await navigator.clipboard.writeText(groupId);
    toast.success("ID do grupo copiado.");
  }

  function groupRank(group: RankingGroup) {
    const groupUsers = users.filter((candidate) => group.memberIds.includes(candidate.uid));
    return rankUsers(groupUsers, logs);
  }

  function editState(group: RankingGroup) {
    return editing[group.id] ?? { name: group.name, description: group.description };
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-4 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-fg shadow-accent">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-accent-strong">Meus grupos</p>
              <h2 className="text-2xl font-black text-fg">Criar ranking privado</h2>
              <p className="mt-1 text-sm text-fg-muted">Cada usuario pode criar um grupo e vira admin dele.</p>
            </div>
          </div>

          {ownedGroup ? (
            <div className="rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
              <p className="text-sm text-fg-muted">Voce ja administra um grupo.</p>
              <p className="mt-1 text-lg font-black text-fg">{ownedGroup.name}</p>
              <p className="mt-1 text-sm text-fg-muted">ID: <span className="font-mono text-accent-strong">{ownedGroup.id}</span></p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-fg-soft">Nome do grupo</span>
                <input
                  className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                  maxLength={GROUP_NAME_MAX_LENGTH}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Equipe Financeiro"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-fg-soft">Descricao</span>
                <textarea
                  className="min-h-24 w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                  maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Ranking interno da galera..."
                />
              </label>
              <button
                disabled={busy || !normalizeGroupName(newName)}
                onClick={() => void handleCreateGroup()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                Criar grupo
              </button>
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-sm font-bold text-accent-strong">Entrar por ID</p>
            <h2 className="text-2xl font-black text-fg">Recebeu um codigo?</h2>
            <p className="mt-1 text-sm text-fg-muted">Cole o ID compartilhado pelo admin do grupo.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="min-w-0 rounded-2xl border border-line/10 bg-field px-4 py-3 font-mono uppercase tracking-[0.12em] text-fg outline-none"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={32}
            />
            <button
              disabled={busy || !joinCode.trim()}
              onClick={() => void handleJoinGroup()}
              className="rounded-2xl border border-line/10 bg-panel px-5 py-3 font-black text-fg transition hover:bg-panel-strong disabled:opacity-60"
            >
              Entrar
            </button>
          </div>
        </Card>
      </section>

      {myGroups.length === 0 ? (
        <Card>
          <div className="rounded-2xl border border-dashed border-line/15 p-8 text-center text-fg-muted">
            Voce ainda nao participa de nenhum grupo.
          </div>
        </Card>
      ) : (
        myGroups.map((group) => {
          const isGroupAdmin = group.ownerId === user.uid || user.role === "admin";
          const state = editState(group);
          const ranked = groupRank(group);

          return (
            <Card key={group.id}>
              <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 truncate text-2xl font-black text-fg">{group.name}</h2>
                    <span className="rounded-full bg-accent-soft/35 px-2 py-1 text-xs font-black text-accent-strong">
                      Edicao {toRoman(group.edition)}
                    </span>
                  </div>
                  {group.description ? <p className="mt-1 text-sm text-fg-muted">{group.description}</p> : null}
                  <p className="mt-2 text-xs text-fg-muted">
                    {group.memberCount} membro(s) · criado em {formatDateTime(group.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => void copyGroupId(group.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line/10 bg-panel px-4 py-3 font-black text-fg transition hover:bg-panel-strong"
                  title="Copiar ID do grupo"
                >
                  <Copy size={18} />
                  <span className="font-mono">{group.id}</span>
                </button>
              </div>

              {isGroupAdmin ? (
                <div className="mb-5 rounded-2xl border border-line/10 bg-panel-strong/40 p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                    <label>
                      <span className="mb-2 block text-sm font-bold text-fg-soft">Nome</span>
                      <input
                        className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                        maxLength={GROUP_NAME_MAX_LENGTH}
                        value={state.name}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [group.id]: { ...state, name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-bold text-fg-soft">Descricao</span>
                      <input
                        className="w-full rounded-2xl border border-line/10 bg-field px-4 py-3 text-fg outline-none"
                        maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                        value={state.description}
                        onChange={(event) =>
                          setEditing((current) => ({
                            ...current,
                            [group.id]: { ...state, description: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <button
                      disabled={
                        busy ||
                        !normalizeGroupName(state.name) ||
                        (normalizeGroupName(state.name) === group.name &&
                          normalizeGroupDescription(state.description) === group.description)
                      }
                      onClick={() =>
                        void run(
                          () => updateGroup(user, group, state),
                          "Grupo atualizado.",
                        )
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-black text-accent-fg transition hover:bg-accent-strong disabled:opacity-60"
                    >
                      <Save size={18} />
                      Salvar
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <div>
                  <div className="mb-4">
                    <p className="text-sm font-bold text-accent-strong">Ranking do grupo</p>
                    <h3 className="text-xl font-black text-fg">Semana atual</h3>
                  </div>
                  <RankingList users={ranked} mode="weekly" currentUid={user.uid} onViewProfile={onViewProfile} />
                </div>

                <div>
                  <div className="mb-4">
                    <p className="text-sm font-bold text-accent-strong">Membros</p>
                    <h3 className="text-xl font-black text-fg">Participantes</h3>
                  </div>
                  <div className="space-y-2">
                    {group.memberIds.map((memberId) => {
                      const member = usersById.get(memberId);
                      const isOwner = memberId === group.ownerId;
                      return (
                        <div key={memberId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-line/10 bg-panel-strong/40 p-3">
                          <button
                            className="min-w-0 text-left"
                            onClick={() => onViewProfile(memberId)}
                            disabled={!member}
                          >
                            <p className="truncate font-black text-fg">{member?.name ?? memberId}</p>
                            <p className="text-xs text-fg-muted">{isOwner ? "Admin do grupo" : "Membro"}</p>
                          </button>
                          {isGroupAdmin && !isOwner ? (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => removeGroupMember(user, group, memberId),
                                  "Membro removido.",
                                )
                              }
                              className="rounded-xl bg-danger-soft/45 p-2 text-danger transition hover:bg-danger-soft/65 disabled:opacity-60"
                              title="Remover membro"
                            >
                              <UserMinus size={18} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
