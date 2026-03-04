'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Brain, ShieldCheck, ArrowRight, ChevronRight, Zap, Target, Users,
  Package, FileCheck,
} from 'lucide-react';

/* ── Animated Background ─────────────────────────────────────── */

function AnimatedBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.2, 0.12] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '-10%', right: '-5%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(43,65,98,0.35) 0%, transparent 70%)',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.18, 0.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(157,92,99,0.3) 0%, transparent 70%)',
        }}
      />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.03,
        backgroundImage: `linear-gradient(rgba(255,250,204,0.3) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,250,204,0.3) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />
    </div>
  );
}

/* ── Floating Particles ──────────────────────────────────────── */

function FloatingParticles() {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; duration: number }[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 10 + 10,
      }))
    );
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          animate={{ y: [0, -30, 0], opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(255,250,204,0.4)',
          }}
        />
      ))}
    </div>
  );
}

/* ── Navigation ──────────────────────────────────────────────── */

function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        padding: '16px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: scrolled ? 'rgba(15,9,2,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(133,135,124,0.12)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #2B4162, #9D5C63)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={18} color="#FFFACC" />
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#FFFACC', letterSpacing: '-0.02em' }}>
          ProcureAI
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {['Features', 'Pipeline', 'Results'].map(label => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            style={{ color: '#85877C', fontSize: 14, textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFACC')}
            onMouseLeave={e => (e.currentTarget.style.color = '#85877C')}
          >
            {label}
          </a>
        ))}
        <Link
          href="/dashboard"
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: 'linear-gradient(135deg, #2B4162, #9D5C63)',
            color: '#FFFACC', fontSize: 13, fontWeight: 600,
            textDecoration: 'none', transition: 'opacity 0.2s',
          }}
        >
          Open Dashboard
        </Link>
      </div>
    </motion.nav>
  );
}

/* ── Hero Section ────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section style={{
      position: 'relative', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '120px 40px 80px',
      overflow: 'hidden',
    }}>
      <AnimatedBackground />
      <FloatingParticles />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: 900, textAlign: 'center' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 100, marginBottom: 32,
            background: 'rgba(43,65,98,0.2)', border: '1px solid rgba(43,65,98,0.3)',
          }}
        >
          <Zap size={14} color="#4A6FA8" />
          <span style={{ fontSize: 13, color: '#4A6FA8', fontWeight: 500 }}>
            AI-Powered Supply Chain Automation
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800,
            lineHeight: 1.08, letterSpacing: '-0.03em',
            color: '#FFFACC', margin: '0 0 24px',
          }}
        >
          Intelligent
          <br />
          <span style={{
            background: 'linear-gradient(135deg, #4A6FA8, #9D5C63)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Purchase Orders
          </span>
          <br />
          on Autopilot
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          style={{
            fontSize: 18, lineHeight: 1.7, color: '#85877C',
            maxWidth: 600, margin: '0 auto 40px',
          }}
        >
          Four AI agents collaborate in real-time to analyze demand, select suppliers,
          optimize containers, and compile purchase orders — with human oversight at every step.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <Link
            href="/pipeline"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'linear-gradient(135deg, #2B4162, #9D5C63)',
              color: '#FFFACC', textDecoration: 'none',
              boxShadow: '0 0 40px rgba(43,65,98,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(43,65,98,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 40px rgba(43,65,98,0.3)'; }}
          >
            Run Pipeline <ArrowRight size={18} />
          </Link>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'transparent', color: '#FFFACC',
              border: '1px solid rgba(133,135,124,0.3)',
              textDecoration: 'none', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(133,135,124,0.6)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(133,135,124,0.3)')}
          >
            View Dashboard <ChevronRight size={18} />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          style={{
            display: 'flex', justifyContent: 'center', gap: 48,
            marginTop: 64, paddingTop: 40,
            borderTop: '1px solid rgba(133,135,124,0.12)',
          }}
        >
          {[
            { value: '4', label: 'AI Agents' },
            { value: '4', label: 'MCP Servers' },
            { value: '100%', label: 'Auditable' },
            { value: '<30s', label: 'Per PO' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFACC', fontFamily: 'JetBrains Mono, monospace' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 12, color: '#85877C', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ── Features Section ────────────────────────────────────────── */

const FEATURES = [
  { icon: Brain,       title: 'Demand Analysis',       desc: 'AI forecasts demand from historical data, seasonality, and market signals.',     accent: '#4A6FA8' },
  { icon: Target,      title: 'Supplier Selection',     desc: 'Scores and selects optimal suppliers based on quality, cost, and reliability.',  accent: '#5D9975' },
  { icon: Package,     title: 'Container Optimization', desc: 'Maximizes container utilization to minimize freight costs per unit.',             accent: '#C4883A' },
  { icon: FileCheck,   title: 'PO Compilation',         desc: 'Auto-generates compliant purchase orders with full decision rationale.',         accent: '#9D5C63' },
  { icon: Users,       title: 'Human-in-the-Loop',      desc: 'Manager approval gate ensures oversight before any PO is finalized.',            accent: '#4A6FA8' },
  { icon: ShieldCheck, title: 'Full Audit Trail',        desc: 'Every agent decision logged with inputs, outputs, and confidence scores.',       accent: '#5D9975' },
];

function FeaturesSection() {
  return (
    <section id="features" style={{ padding: '100px 40px', maxWidth: 1100, margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', marginBottom: 64 }}
      >
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#4A6FA8',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Capabilities
        </span>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#FFFACC', margin: '12px 0 16px', letterSpacing: '-0.02em' }}>
          End-to-End Automation
        </h2>
        <p style={{ fontSize: 16, color: '#85877C', maxWidth: 550, margin: '0 auto' }}>
          From demand forecasting to PO approval — four specialized agents handle every step.
        </p>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: '28px 24px', borderRadius: 16,
              background: '#2F2504', border: '1px solid rgba(133,135,124,0.15)',
              transition: 'border-color 0.3s, transform 0.3s',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = f.accent; e.currentTarget.style.transform = 'translateY(-4px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(133,135,124,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${f.accent}20`,
            }}>
              <f.icon size={22} color={f.accent} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#FFFACC', marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: 13, color: '#85877C', lineHeight: 1.6 }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Pipeline Section ────────────────────────────────────────── */

const PIPELINE_STEPS = [
  { agent: 'Demand Analyst',        model: 'gpt-4o-mini', desc: 'Analyzes forecasts, inventory, and market data',   accent: '#4A6FA8' },
  { agent: 'Supplier Selector',     model: 'gpt-4o-mini', desc: 'Scores and ranks suppliers for each SKU',          accent: '#5D9975' },
  { agent: 'Container Optimizer',   model: 'gpt-4o-mini', desc: 'Packs items into containers for lowest freight',   accent: '#C4883A' },
  { agent: 'PO Compiler',           model: 'gpt-4o-mini', desc: 'Generates final PO with full rationale',           accent: '#9D5C63' },
];

function PipelineSection() {
  return (
    <section id="pipeline" style={{ padding: '100px 40px', maxWidth: 1000, margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', marginBottom: 64 }}
      >
        <span style={{
          fontSize: 12, fontWeight: 600, color: '#9D5C63',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Architecture
        </span>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: '#FFFACC', margin: '12px 0 16px', letterSpacing: '-0.02em' }}>
          Multi-Agent Pipeline
        </h2>
        <p style={{ fontSize: 16, color: '#85877C', maxWidth: 550, margin: '0 auto' }}>
          LangGraph orchestrates four specialized agents connected to MCP data servers.
        </p>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 30, top: 40, bottom: 40,
          width: 2, background: 'linear-gradient(to bottom, #4A6FA8, #9D5C63)',
          opacity: 0.3,
        }} />

        {PIPELINE_STEPS.map((step, i) => (
          <motion.div
            key={step.agent}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.15 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 24,
              padding: '20px 0',
            }}
          >
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: `${step.accent}20`, border: `2px solid ${step.accent}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, zIndex: 2,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: step.accent, fontFamily: 'JetBrains Mono, monospace' }}>
                {i + 1}
              </span>
            </div>

            <div style={{
              flex: 1, padding: '18px 24px', borderRadius: 12,
              background: '#2F2504', border: '1px solid rgba(133,135,124,0.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFACC' }}>{step.agent}</span>
                <span style={{
                  fontSize: 11, color: '#85877C', fontFamily: 'JetBrains Mono, monospace',
                  padding: '2px 8px', background: 'rgba(133,135,124,0.1)', borderRadius: 4,
                }}>
                  {step.model}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#85877C', margin: 0 }}>{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Stats Section ───────────────────────────────────────────── */

function StatsSection() {
  const stats = [
    { value: '87%', label: 'Faster PO Generation', desc: 'vs. manual process' },
    { value: '99.2%', label: 'Container Utilization', desc: 'optimal packing' },
    { value: '4x', label: 'Supplier Coverage', desc: 'evaluated per order' },
    { value: '0', label: 'Decisions Without Audit', desc: 'full transparency' },
  ];

  return (
    <section id="results" style={{ padding: '80px 40px', background: 'rgba(47,37,4,0.5)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#FFFACC', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            Built for Impact
          </h2>
          <p style={{ fontSize: 15, color: '#85877C' }}>
            Designed for the Cummins Xtern 2026 competition.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                textAlign: 'center', padding: '28px 16px', borderRadius: 16,
                background: '#1A1006', border: '1px solid rgba(133,135,124,0.12)',
              }}
            >
              <div style={{
                fontSize: 36, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
                background: 'linear-gradient(135deg, #4A6FA8, #9D5C63)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: 8,
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFACC', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: '#85877C' }}>{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA Section ─────────────────────────────────────────────── */

function CTASection() {
  return (
    <section style={{
      padding: '100px 40px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 6, repeat: Infinity }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(43,65,98,0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 36, fontWeight: 800, color: '#FFFACC', margin: '0 0 16px', letterSpacing: '-0.02em' }}
        >
          Ready to automate procurement?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ fontSize: 16, color: '#85877C', maxWidth: 500, margin: '0 auto 36px' }}
        >
          Launch the multi-agent pipeline and generate your first AI-driven purchase order in under 30 seconds.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link
            href="/pipeline"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 40px', borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: 'linear-gradient(135deg, #2B4162, #9D5C63)',
              color: '#FFFACC', textDecoration: 'none',
              boxShadow: '0 0 50px rgba(43,65,98,0.35)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 60px rgba(43,65,98,0.55)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 50px rgba(43,65,98,0.35)'; }}
          >
            Launch Pipeline <ArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer style={{
      padding: '40px 40px', textAlign: 'center',
      borderTop: '1px solid rgba(133,135,124,0.12)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
        {[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/pipeline', label: 'Pipeline' },
          { href: '/approvals', label: 'Approvals' },
          { href: '/suppliers', label: 'Suppliers' },
          { href: '/logs', label: 'Decision Log' },
          { href: '/agents', label: 'Agents' },
        ].map(link => (
          <Link
            key={link.href}
            href={link.href}
            style={{ color: '#85877C', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFFACC')}
            onMouseLeave={e => (e.currentTarget.style.color = '#85877C')}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#85877C' }}>
        ProcureAI &middot; Cummins Xtern 2026 &middot; Multi-Agent PO Automation
      </p>
    </footer>
  );
}

/* ── Landing Page ────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#0F0902', color: '#FFFACC', overflowX: 'hidden' }}>
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <PipelineSection />
      <StatsSection />
      <CTASection />
      <Footer />
    </div>
  );
}
