import Link from 'next/link';

const FEATURE_CARDS = [
  {
    title: 'Demand Intelligence',
    body: 'Convert live inventory and forecast signals into net replenishment plans without spreadsheet stitching.',
    stat: '4-step planning flow',
  },
  {
    title: 'Supplier Optimization',
    body: 'Score suppliers against lead time, cost, and quality to generate traceable vendor decisions for every SKU.',
    stat: 'Top-ranked vendor selection',
  },
  {
    title: 'Container Planning',
    body: 'Estimate freight and utilization before approval to reduce surprises in landed cost and logistics planning.',
    stat: 'Container + freight estimates',
  },
  {
    title: 'Human-in-the-loop Approvals',
    body: 'Keep buyers and managers in control with draft PO review gates, notes, and decision visibility.',
    stat: 'Approval queue + audit trail',
  },
  {
    title: 'Agent Transparency',
    body: 'Track each AI agent with status, confidence, summaries, and errors to improve trust and debugging speed.',
    stat: 'Per-agent execution tabs',
  },
  {
    title: 'Operational Dashboard',
    body: 'Monitor inventory, forecasts, purchase orders, and decision logs in one shared operations surface.',
    stat: 'Live Supabase data',
  },
];

const TRUST_ITEMS = [
  'FastAPI + Next.js full-stack platform',
  'LangGraph multi-agent orchestration',
  'MCP server integration layer',
  'Approval-safe procurement workflow',
];

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="brand-mark brand-mark-sm">P</span>
          ProcurePilot
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/signin" className="button button-secondary">
            Sign In
          </Link>
          <Link href="/dashboard" className="button button-secondary">
            Product Tour
          </Link>
          <Link href="/pipeline" className="button button-primary">
            Run Pipeline
          </Link>
        </div>
      </header>

      <main className="landing-content">
        <section className="hero-card">
          <p className="eyebrow">AI Purchase Order Automation</p>
          <h1 className="hero-title">
            Move from procurement guesswork to
            <span className="hero-highlight"> approval-ready purchase orders </span>
            in minutes.
          </h1>
          <p className="hero-subtitle">
            ProcurePilot combines demand planning, supplier intelligence, logistics estimation, and approval workflows
            into a single operating system for modern supply chain teams.
          </p>
          <div className="hero-cta-row">
            <Link href="/pipeline" className="button button-primary">
              Launch Pipeline
            </Link>
            <Link href="/dashboard" className="button button-secondary">
              Open Dashboard
            </Link>
          </div>
          <p className="hero-notice">Dashboard route moved from `/` to `/dashboard` as part of the redesign.</p>
        </section>

        <section className="trust-strip">
          {TRUST_ITEMS.map(item => (
            <div key={item} className="trust-pill">
              {item}
            </div>
          ))}
        </section>

        <section className="section-wrap">
          <div className="section-header">
            <p className="eyebrow">Core Product Pillars</p>
            <h2 className="section-title">Bento modules designed for procurement velocity</h2>
            <p className="section-subtitle">
              Each block in the workflow maps directly to a high-friction procurement decision in real teams.
            </p>
          </div>

          <div className="bento-grid">
            {FEATURE_CARDS.map((feature, index) => (
              <article key={feature.title} className={`bento-card bento-card-${(index % 3) + 1}`}>
                <p className="bento-stat">{feature.stat}</p>
                <h3 className="bento-title">{feature.title}</h3>
                <p className="bento-body">{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-wrap">
          <div className="section-header">
            <p className="eyebrow">How It Works</p>
            <h2 className="section-title">One orchestrated pipeline, four specialized agents</h2>
          </div>

          <div className="flow-grid">
            {[
              { step: '01', title: 'Demand Analyst', text: 'Calculates replenishment requirements from inventory, forecast, and safety stock.' },
              { step: '02', title: 'Supplier Selector', text: 'Ranks suppliers and recommends the best fit for each order line.' },
              { step: '03', title: 'Container Optimizer', text: 'Estimates container usage and freight cost before PO approval.' },
              { step: '04', title: 'PO Compiler', text: 'Generates a draft PO summary and routes it for human review.' },
            ].map(step => (
              <div key={step.step} className="flow-card">
                <p className="flow-step">{step.step}</p>
                <h3 className="flow-title">{step.title}</h3>
                <p className="flow-body">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-panel">
          <div>
            <p className="eyebrow">Ready To Explore</p>
            <h2 className="section-title">Start with the live product workspace</h2>
            <p className="section-subtitle">Run a pipeline, inspect agent outputs, and review draft purchase orders end-to-end.</p>
          </div>
          <div className="cta-actions">
            <Link href="/dashboard" className="button button-secondary">
              View Dashboard
            </Link>
            <Link href="/pipeline" className="button button-primary">
              Run Pipeline
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
