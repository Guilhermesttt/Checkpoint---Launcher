import * as React from "react";
import { Camera, Gamepad2, Trophy, Users } from "lucide-react";
import type { SocialActivity } from "../types/domain";
import { subscribeSocialFeed } from "../services/socialActivity";

interface SocialFeedPageProps {
  userIds: string[];
}

const relativeTime = (value: string) => {
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
};

const activityText = (activity: SocialActivity) => {
  if (activity.kind === "achievement") return `desbloqueou ${activity.achievementName || "uma conquista"}`;
  if (activity.kind === "capture") return activity.caption || "publicou uma captura";
  return `começou a jogar ${activity.gameTitle || "um jogo"}`;
};

const SocialFeedPage: React.FC<SocialFeedPageProps> = ({ userIds }) => {
  const [activities, setActivities] = React.useState<SocialActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const idsKey = userIds.join("|");

  React.useEffect(() => {
    const unsubscribe = subscribeSocialFeed(
      userIds[0] || "",
      (next) => {
        setActivities(next);
        setLoading(false);
      },
      (feedError) => {
        const code = String((feedError as Error & { code?: string }).code || "");
        console.error("[feed] Falha ao carregar atividades:", feedError);
        setError(
          code.includes("failed-precondition")
            ? "O índice do feed ainda não foi publicado no Firebase."
            : code.includes("permission-denied")
              ? "O Firestore recusou a consulta do feed. Atualize sua sessão e tente novamente."
              : "Não foi possível carregar o feed.",
        );
        setLoading(false);
      },
    );
    return unsubscribe;
    // idsKey representa a lista normalizada de pessoas visíveis no feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return (
    <div className="flex-1 overflow-y-auto px-10 pb-12 pt-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Social</p>
            <h1 className="mt-2 text-3xl font-black text-white">Atividade</h1>
            <p className="mt-2 text-sm text-white/35">Jogos e conquistas suas e dos seus amigos.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/45">
            <Users className="h-4 w-4" /> {Math.max(0, userIds.length - 1)} amigos
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-white/35">Carregando atividade...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-400/15 bg-red-500/[0.06] p-10 text-center text-sm text-red-200/70">{error}</div>
        ) : activities.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Gamepad2 className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-4 text-sm font-semibold text-white/55">Nenhuma atividade ainda</p>
            <p className="mt-1 text-xs text-white/30">Inicie um jogo para criar o primeiro evento do feed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = activity.kind === "achievement" ? Trophy : activity.kind === "capture" ? Camera : Gamepad2;
              return (
                <article key={activity.id} className="flex gap-4 rounded-3xl border border-white/[0.08] bg-black/35 p-5 backdrop-blur-2xl">
                  <img
                    src={activity.userAvatar || "/USER-AND-FUN.png"}
                    alt=""
                    className="h-11 w-11 rounded-full border border-white/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-white/65"><strong className="text-white">{activity.userName}</strong> {activityText(activity)}</p>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-white/25">{relativeTime(activity.createdAt)}</span>
                    </div>
                    {(activity.gameTitle || activity.achievementName) && (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                        {activity.achievementIcon || activity.gameImage ? (
                          <img src={activity.achievementIcon || activity.gameImage} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05]"><Icon className="h-5 w-5 text-white/30" /></div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white/70">{activity.achievementName || activity.gameTitle}</p>
                          {activity.kind === "achievement" && <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-amber-300/55">{activity.gameTitle}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialFeedPage;
