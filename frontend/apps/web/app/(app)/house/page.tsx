"use client";
/**
 * House Fund (brief 13.10): balance, fees in, paid out, the default rate and the reserve
 * rule; the bunting chart; every flow as a ledger. Live from the program on devnet
 * (sample until the indexer is up). Plain at money.
 */
import { useMemo, useState } from "react";
import { formatMoney, truncateId } from "@kitty/sdk";
import { Button } from "@kitty/ui/components/Button";
import { ChipGroup } from "@kitty/ui/components/Chip";
import { Icon } from "@kitty/ui/components/Icon";
import { LedgerRoll } from "@kitty/ui/components/Ledger";
import { Money } from "@kitty/ui/components/Money";
import { PageHeader } from "@/components/chrome/PageHeader";
import { BuntingChart } from "@/components/stage/BuntingChart";
import { copy } from "@/copy/en";
import { IS_SAMPLE, statusOf, useHouse } from "@/data/api";
import { LINKS } from "@/lib/links";

type Range = "7d" | "30d" | "all";
const KIND = { "fee-in": "Fee in", "cover-out": "Cover out", "settle-in": "Settle-up in" } as const;

export default function HousePage() {
  const q = useHouse();
  const status = statusOf(q);
  const [range, setRange] = useState<Range>("all");
  const [page, setPage] = useState(0);
  const series = useMemo(() => {
    const s = q.data?.series ?? [];
    return range === "7d" ? s.slice(-2) : range === "30d" ? s.slice(-5) : s;
  }, [q.data, range]);
  const flows = q.data?.flows ?? [];
  const pages = Math.ceil(flows.length / 20);

  return (
    <>
      <PageHeader title={copy.nav.house} context={IS_SAMPLE ? "Devnet · sample data until the program is live" : "Devnet · live from the program"} />
      {status === "loading" && <div className="fold-lines" style={{ height: 520 }} aria-busy="true" />}
      {status === "error" && (
        <div className="card" role="alert">
          <p className="type-body">{copy.error.network}</p>
          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" size="S" onClick={() => q.refetch()}>
              {copy.cta.retry}
            </Button>
          </div>
        </div>
      )}
      {status !== "loading" && status !== "error" && q.data && (
        <>
          <p className="type-body-l" style={{ maxWidth: "52ch", marginBottom: 32, color: "var(--fg-soft)" }} data-enter>
            {copy.house.line} Every guest chips in a small House fee; when a guest misses, the House Fund covers the gap and they settle up later.
          </p>
          <section className="house-stats" aria-label="House Fund totals" data-enter>
            <div>
              <span className="type-label">Balance</span>
              <Money micro={q.data.balance} size="money-xl" />
            </div>
            <div>
              <span className="type-label">Fees in</span>
              <Money micro={q.data.feesIn} size="money-xl" />
            </div>
            <div>
              <span className="type-label">Paid out</span>
              <Money micro={q.data.paidOut} size="money-xl" />
            </div>
            <div>
              <span className="type-label">Default rate</span>
              <span className="type-money-l">
                <LedgerRoll value={(q.data.defaultRateBps / 100).toFixed(1)} />%
              </span>
              <span className="type-small" style={{ color: "var(--fg-soft)" }}>
                {q.data.reserveOk ? "Above the 10% reserve" : "Below the 10% reserve: new parties pause"}
              </span>
            </div>
          </section>

          <section className="card house-chart" aria-labelledby="chart-h" data-enter>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <h2 id="chart-h" className="type-h2">
                Balance
              </h2>
              <ChipGroup<Range>
                label="Range"
                filter
                value={range}
                onChange={setRange}
                options={[
                  { value: "7d", label: "7d" },
                  { value: "30d", label: "30d" },
                  { value: "all", label: "All" },
                ]}
              />
            </div>
            <BuntingChart key={range} series={series} height={360} label={IS_SAMPLE ? "Devnet sample data" : "Devnet"} />
          </section>

          <section className="card" aria-labelledby="flows-h" data-enter style={{ marginTop: 24 }}>
            <h2 id="flows-h" className="type-h2" style={{ marginBottom: 16 }}>
              Flows
            </h2>
            <table className="ledger-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                  <th scope="col" className="num">
                    Balance after
                  </th>
                  <th scope="col">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {flows.slice(page * 20, page * 20 + 20).map((f) => (
                  <tr key={f.id}>
                    <td data-label="Date">{new Date(f.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                    <td data-label="Kind">{KIND[f.kind]}</td>
                    <td data-label="Amount" className="num type-money">
                      {formatMoney(f.kind === "cover-out" ? -f.amount : f.amount, { sign: true })}
                    </td>
                    <td data-label="Balance after" className="num type-money">
                      {formatMoney(f.balanceAfter)}
                    </td>
                    <td data-label="Transaction">
                      <a className="type-mono" href={LINKS.explorer(f.sig)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}>
                        {truncateId(f.sig)} <Icon name="external" size={16} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                <Button size="S" variant="ghost" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  Newer
                </Button>
                <span className="type-mono" style={{ alignSelf: "center" }}>
                  {page + 1} / {pages}
                </span>
                <Button size="S" variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>
                  Older
                </Button>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
