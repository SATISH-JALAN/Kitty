import { demoTag, partyName, TRADITIONS, type TraditionKey } from "@kitty/sdk";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Mask } from "@kitty/ui/generators/mask";
import { patternCss } from "@kitty/ui/generators/patterns";
import { BowMask } from "@kitty/ui/brand/BowMask";
import { Lockup, Wordmark } from "@kitty/ui/brand/Wordmark";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";

export const metadata = { title: "Lab · masks" };

const keys = TRADITIONS.map((t) => t.key) as TraditionKey[];

export default function MasksLab() {
  const masks = Array.from({ length: 48 }, (_, i) => {
    const tag = demoTag(`guest-${i}`);
    return { tag, name: partyName(tag).name, tradition: keys[i % keys.length] };
  });
  return (
    <main className="px-page py-16 flex flex-col gap-16">
      <header className="flex items-end justify-between gap-8 flex-wrap">
        <div>
          <p className="type-label text-[var(--fg-soft)]">Lab</p>
          <h1 className="type-h1">Masks, emblems, patterns</h1>
        </div>
        <Lockup height={36} interactive />
      </header>

      <section className="flex flex-col gap-6">
        <h2 className="type-h2">Brand</h2>
        <div className="flex flex-wrap items-center gap-10">
          <BowMask width={160} interactive label="Kitty" />
          <BowMask width={64} interactive />
          <BowMask width={24} />
          <BowMask width={16} tone="mono" colour="var(--ink)" />
          <Wordmark height={96} interactive />
          <WaxSeal size={160} />
          <WaxSeal size={96} cracked={2} />
          <WaxSeal size={48} />
          <WaxSeal size={24} />
        </div>
        <div data-world="night" className="flex flex-wrap items-center gap-10 bg-[var(--bg)] text-[var(--fg)] p-8 cut">
          <Lockup height={28} interactive />
          <Wordmark height={64} ink="var(--moon)" interactive />
          <BowMask width={96} interactive />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="type-h2">48 masks</h2>
        <div className="grid gap-x-6 gap-y-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
          {masks.map((m, i) => (
            <figure key={i} className="flex flex-col items-center gap-2">
              <Mask tag={m.tag} tradition={m.tradition} width={160} tilt />
              <figcaption className="type-small type-word text-[17px]">{m.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section data-world="night" className="flex flex-col gap-6 bg-[var(--bg)] text-[var(--fg)] p-8 cut">
        <h2 className="type-h2">On night · all twelve animals · sizes</h2>
        <div className="flex flex-wrap items-end gap-6">
          {Array.from({ length: 12 }, (_, a) => (
            <Mask key={a} colour={(a * 5) % 16} animal={a} tradition={keys[a % 7]} width={120} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Mask colour={0} animal={0} width={320} tradition="paluwagan" />
          <Mask colour={0} animal={0} width={160} />
          <Mask colour={0} animal={0} width={72} />
          <Mask colour={0} animal={0} width={48} />
          <Mask colour={0} animal={0} width={32} />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="type-h2">Emblems</h2>
        <div className="flex flex-wrap items-end gap-8">
          {keys.map((k, i) => (
            <Emblem key={k} partyId={`party-${i}`} guests={[10, 8, 12, 6, 20, 4, 10][i]} tradition={k} size={120} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Emblem partyId="asha" guests={10} tradition="paluwagan" size={240} />
          <Emblem partyId="asha" guests={10} tradition="paluwagan" size={64} />
          <Emblem partyId="asha" guests={10} tradition="paluwagan" size={40} />
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="type-h2">Patterns (100% and 8%)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-2">
              <div className="h-40 cut hairline" style={{ backgroundImage: patternCss(k) }} />
              <div className="h-24 cut hairline relative overflow-hidden">
                <div className="absolute inset-0" style={{ backgroundImage: patternCss(k, "#22151F", "#22151F"), opacity: 0.08 }} />
              </div>
              <span className="type-word text-[17px]">{k}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
