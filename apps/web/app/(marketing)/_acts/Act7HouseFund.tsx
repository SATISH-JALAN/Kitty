"use client";
/**
 * Act 7 · The House Fund (brief 11, Act 7). Night, 100svh + pinned 120vh.
 * Plain totals in money-xl (present at frame 0), then the bunting chart: the twine
 * draws left to right and each lantern lights as the string reaches it. The seal
 * knots the net at the first point (D7). Devnet sample data, labelled.
 */
import { useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { LedgerRoll } from "@kitty/ui/components/Ledger";
import { Money } from "@kitty/ui/components/Money";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { BuntingChart } from "@/components/stage/BuntingChart";
import { copy } from "@/copy/en";
import { sampleHouse } from "@/data/sample";

export function Act7HouseFund() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const director = useSealDirector();
  const house = useMemo(() => sampleHouse(new Date("2026-10-01T12:00:00Z")), []);
  const [drawn, setDrawn] = useState<number>(0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        setDrawn(1);
        director.set("D6", "D7", 1);
        return;
      }
      const s = { p: 0 };
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: section.current, start: "top top", end: "+=120%", pin: pin.current, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
      });
      tl.add(flightTween(director, "D6", "D7", 0.1), 0).to(s, { p: 1, duration: 0.6, onUpdate: () => setDrawn(s.p) }, 0).to({}, { duration: 0.4 });
    },
    { scope: section },
  );

  return (
    <section ref={section} id="act-7" data-section-world="night" data-world="night" className="act7" aria-labelledby="act7-title">
      <div ref={pin} className="act7-pin grid-page">
        <div className="a7-head">
          <h2 id="act7-title" className="type-h1">
            {copy.act7.title}
          </h2>
          <p className="type-body-l" style={{ color: "var(--moon-soft)", maxWidth: "46ch", marginTop: 14 }}>
            {copy.act7.body}
          </p>
        </div>
        <div className="a7-stats">
          <div>
            <span className="type-label">Balance</span>
            <Money micro={house.balance} size="money-xl" />
          </div>
          <div>
            <span className="type-label">Fees in</span>
            <Money micro={house.feesIn} size="money-xl" />
          </div>
          <div>
            <span className="type-label">Paid out</span>
            <Money micro={house.paidOut} size="money-xl" />
          </div>
          <div>
            <span className="type-label">Default rate</span>
            <span className="type-money-l">
              <LedgerRoll value={(house.defaultRateBps / 100).toFixed(1)} />%
            </span>
          </div>
        </div>
        <div className="a7-chart">
          <SealDock id="D7" size={32} className="a7-knot" />
          <BuntingChart series={house.series} height={300} drawn={drawn} label={copy.act7.sample} />
        </div>
      </div>
    </section>
  );
}
