import { useState } from "react";
import { cn } from "../utils/cn";
import { agents, profiles } from "../data";
import { agentPhoto, photos, profilePhoto } from "../images";
import { AvatarPhoto, Credit, Photo } from "../components/Photo";
import { Icon } from "../components/icons";
import { PageHeader, PageShell } from "../components/Shell";
import { Button, Chip, Eyebrow, Meter, Panel, PanelHead, StatusDot } from "../components/ui";

export function Profiles({
  notify,
  onNavigate,
}: {
  notify: (title: string, detail?: string, tone?: "ok" | "warn" | "info") => void;
  onNavigate: (p: "addons" | "fleet") => void;
}) {
  const [selected, setSelected] = useState("mt-fuji");
  const [mounted, setMounted] = useState("mt-fuji");
  const current = profiles.find((p) => p.id === selected) ?? profiles[0];

  const mount = () => {
    setMounted(current.id);
    notify("Profile mounted", `${current.name} · ${current.sub} · routing updated`);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Agent profiles"
        title={<>Faces of the <span className="display italic text-blush">pavilion.</span></>}
        serif
        description="Five personas, one foreman. Mount a profile to change voice, loadout, and routing behaviour without restarting the cluster."
        actions={
          <>
            <Button variant="secondary" icon="refresh" onClick={() => notify("Profiles refreshed", "5 personas · 1 mounted")}>Refresh</Button>
            <Button variant="primary" icon={mounted === current.id ? "check" : "play"} onClick={mount} disabled={mounted === current.id}>
              {mounted === current.id ? "Currently mounted" : `Mount ${current.name}`}
            </Button>
          </>
        }
        meta={
          <>
            <Chip tone="ok" dot>5 personas available</Chip>
            <span className="font-mono text-[9.5px] text-ink-mute">active · {profiles.find((p) => p.id === mounted)?.name}</span>
            <span className="font-mono text-[9.5px] text-ink-mute">swap cost · 1.8s</span>
          </>
        }
      />

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p, i) => {
          const isSel = selected === p.id;
          const isMounted = mounted === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={cn(
                "panel group overflow-hidden p-0 text-left transition-all duration-300",
                isSel ? "border-blush/30 shadow-[0_0_0_1px_rgba(240,174,192,.12),0_24px_60px_-40px_rgba(240,174,192,.4)]" : "hover:border-white/[0.13] hover:-translate-y-px",
              )}
            >
              <div className="relative h-[148px] overflow-hidden">
                <Photo
                  src={profilePhoto[p.id] ?? photos.garden}
                  alt={`${p.name} — ${p.sub}`}
                  className="absolute inset-0 h-full w-full"
                  grade="night"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#121014] via-[#121014]/20 to-transparent" />
                <div className="absolute left-3 top-3">
                  {isMounted ? <Chip tone="blush" dot>Mounted</Chip> : <Chip tone="neutral" className="!bg-black/35 !backdrop-blur">Standby</Chip>}
                </div>
                <div className="absolute bottom-3 left-4 right-4">
                  <Eyebrow className="!text-[7.5px] !text-white/40">Persona {String(i + 1).padStart(2, "0")}</Eyebrow>
                  <p className="mt-1 text-[15px] text-ink">{p.name}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] text-ink-dim">{p.sub}</p>
                    <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-mute">{p.note}</p>
                  </div>
                  <Icon name={isSel ? "check" : "arrow-up-right"} size={14} className={cn("shrink-0", isSel ? "text-blush" : "text-ink-mute/50")} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Meter value={isMounted ? 100 : 12} tone={isMounted ? "blush" : "dim"} />
                  <span className="w-8 shrink-0 text-right font-mono text-[8.5px] text-ink-mute">{isMounted ? "live" : "off"}</span>
                </div>
              </div>
            </button>
          );
        })}

        <div className="panel flex min-h-[248px] flex-col items-center justify-center gap-3 border-dashed bg-transparent p-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.09] bg-white/[0.02] text-ink-mute"><Icon name="plus" size={16} /></span>
          <div>
            <p className="text-[12.5px] text-ink-dim">Compose a new persona</p>
            <p className="mt-1 max-w-[200px] text-[10.5px] leading-relaxed text-ink-mute">Clone an existing profile or start from a blank voice and loadout.</p>
          </div>
          <Button variant="quiet" size="sm" onClick={() => notify("Composer opened", "Profile draft · unarmed", "info")}>New profile</Button>
        </div>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <PanelHead eyebrow="Fleet roster" title="Worker registry" meta={<Chip tone="ok" dot>8 responding</Chip>} />
          <Button variant="ghost" size="sm" iconRight="arrow-right" onClick={() => onNavigate("fleet")}>Back to fleet</Button>
        </div>
        <div className="hidden grid-cols-[1.5fr_1fr_110px_140px_110px] gap-4 border-y border-white/[0.055] bg-white/[0.014] px-5 py-2.5 font-mono text-[8.5px] uppercase tracking-[0.16em] text-ink-mute md:grid">
          <span>Agent</span><span>Assignment</span><span>Region</span><span>Cluster load</span><span className="text-right">State</span>
        </div>
        <ul>
          {agents.map((a) => (
            <li key={a.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/[0.045] px-5 py-3 transition-colors last:border-0 hover:bg-white/[0.018] md:grid md:grid-cols-[1.5fr_1fr_110px_140px_110px]">
              <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
                <AvatarPhoto src={agentPhoto[a.id]} alt={a.name} size={26} />
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-ink">{a.name}</div>
                  <div className="font-mono text-[8.5px] text-ink-mute">{a.id}</div>
                </div>
              </div>
              <span className="text-[11px] text-ink-dim md:text-[11.5px]">{a.role}</span>
              <span className="font-mono text-[9.5px] text-ink-mute">{a.region}</span>
              <div className="hidden items-center gap-2 md:flex">
                <Meter value={a.load} tone={a.load > 80 ? "amber" : "blush"} className="max-w-[80px]" />
                <span className="font-mono text-[9px] text-ink-mute">{a.load}%</span>
              </div>
              <div className="ml-auto flex items-center gap-2 md:ml-0 md:justify-end">
                <Chip tone={a.status === "warn" ? "warn" : a.status === "idle" ? "idle" : "ok"} dot>{a.state}</Chip>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <span className="flex items-center gap-1.5 font-mono text-[9px] text-ink-mute"><StatusDot tone="ok" /> all workers acknowledged supervisor ping</span>
          <div className="flex items-center gap-3">
            <Credit>Photos · Pexels contributors</Credit>
            <button onClick={() => onNavigate("addons")} className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute transition-colors hover:text-blush">manage add-ons</button>
          </div>
        </div>
      </Panel>
    </PageShell>
  );
}


