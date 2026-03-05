'use client'
import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { ProgressiveBlur } from '@/components/ui/progressive-blur'
import { cn } from '@/lib/utils'
import { Menu, X, Brain, Target, Package, FileCheck, ShieldCheck, Users, ArrowRight, Zap } from 'lucide-react'

/* ── Logo ────────────────────────────────────────────────────── */

const Logo = ({ className }: { className?: string }) => (
    <div className={cn('flex items-center gap-2', className)}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#2B4162] to-[#9D5C63]">
            <Brain className="h-4 w-4 text-[#FFFACC]" />
        </div>
        <span className="text-lg font-bold tracking-tight text-[#FFFACC]">ProcureAI</span>
    </div>
)

/* ── Header ──────────────────────────────────────────────────── */

const menuItems = [
    { name: 'Features', href: '#features' },
    { name: 'Pipeline', href: '#pipeline' },
    { name: 'Results', href: '#results' },
    { name: 'About', href: '#about' },
]

const HeroHeader = () => {
    const [menuState, setMenuState] = React.useState(false)
    return (
        <header>
            <nav
                data-state={menuState && 'active'}
                className="group fixed z-20 w-full border-b border-[rgba(133,135,124,0.12)] bg-[#0F0902]/50 backdrop-blur-3xl">
                <div className="mx-auto max-w-6xl px-6 transition-all duration-300">
                    <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
                            <Link href="/" aria-label="home" className="flex items-center space-x-2">
                                <Logo />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Menu className="group-data-[state=active]:rotate-180 group-data-[state=active]:scale-0 group-data-[state=active]:opacity-0 m-auto size-6 text-[#FFFACC] duration-200" />
                                <X className="group-data-[state=active]:rotate-0 group-data-[state=active]:scale-100 group-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 text-[#FFFACC] opacity-0 duration-200" />
                            </button>

                            <div className="hidden lg:block">
                                <ul className="flex gap-8 text-sm">
                                    {menuItems.map((item, index) => (
                                        <li key={index}>
                                            <Link
                                                href={item.href}
                                                className="block text-[#85877C] duration-150 hover:text-[#FFFACC]">
                                                <span>{item.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="group-data-[state=active]:block lg:group-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border border-[rgba(133,135,124,0.12)] bg-[#0F0902] p-6 shadow-2xl md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
                                    {menuItems.map((item, index) => (
                                        <li key={index}>
                                            <Link
                                                href={item.href}
                                                className="block text-[#85877C] duration-150 hover:text-[#FFFACC]">
                                                <span>{item.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                                <Button asChild variant="outline" size="sm" className="border-[rgba(133,135,124,0.3)] bg-transparent text-[#FFFACC] hover:bg-[#2F2504] hover:text-[#FFFACC]">
                                    <Link href="/login">
                                        <span>Login</span>
                                    </Link>
                                </Button>
                                <Button asChild size="sm" className="bg-gradient-to-r from-[#2B4162] to-[#9D5C63] text-[#FFFACC] hover:opacity-90">
                                    <Link href="/pipeline">
                                        <span>Open Dashboard</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}

/* ── Hero Section ────────────────────────────────────────────── */

function HeroMain() {
    return (
        <>
            <HeroHeader />
            <main className="overflow-x-hidden bg-[#0F0902] text-[#FFFACC]">
                {/* Hero */}
                <section>
                    <div className="pb-24 pt-12 md:pb-32 lg:pb-56 lg:pt-44">
                        <div className="relative mx-auto flex max-w-6xl flex-col px-6 lg:block">
                            <div className="mx-auto max-w-lg text-center lg:ml-0 lg:w-1/2 lg:text-left">
                                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(43,65,98,0.3)] bg-[rgba(43,65,98,0.2)] px-4 py-1.5">
                                    <Zap className="h-3.5 w-3.5 text-[#4A6FA8]" />
                                    <span className="text-xs font-medium text-[#4A6FA8]">AI-Powered Supply Chain</span>
                                </div>
                                <h1 className="mt-8 max-w-2xl text-balance text-5xl font-medium md:text-6xl lg:mt-16 xl:text-7xl">
                                    Intelligent{' '}
                                    <span className="bg-gradient-to-r from-[#4A6FA8] to-[#9D5C63] bg-clip-text text-transparent">
                                        Purchase Orders
                                    </span>{' '}
                                    on Autopilot
                                </h1>
                                <p className="mt-8 max-w-2xl text-pretty text-lg text-[#85877C]">
                                    Four AI agents collaborate in real-time to analyze demand, select suppliers,
                                    optimize containers, and compile purchase orders — with human oversight at every step.
                                </p>

                                <div className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start">
                                    <Button asChild size="lg" className="bg-gradient-to-r from-[#2B4162] to-[#9D5C63] px-5 text-base text-[#FFFACC] shadow-[0_0_40px_rgba(43,65,98,0.3)] hover:opacity-90">
                                        <Link href="/pipeline">
                                            <span className="text-nowrap">Run Pipeline</span>
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button asChild size="lg" variant="ghost" className="px-5 text-base text-[#FFFACC] hover:bg-[#2F2504]">
                                        <Link href="/dashboard">
                                            <span className="text-nowrap">View Dashboard</span>
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                            <img
                                className="pointer-events-none order-first ml-auto h-56 w-full object-cover opacity-80 sm:h-96 lg:absolute lg:inset-0 lg:-right-20 lg:-top-96 lg:order-last lg:h-max lg:w-2/3 lg:object-contain dark:mix-blend-lighten"
                                src="https://ik.imagekit.io/lrigu76hy/tailark/abstract-bg.jpg?updatedAt=1745733473768"
                                alt="Abstract Background"
                                height="4000"
                                width="3000"
                            />
                        </div>
                    </div>
                </section>

                {/* Logo Slider */}
                <section className="bg-[#0F0902] pb-16 md:pb-32">
                    <div className="group relative m-auto max-w-6xl px-6">
                        <div className="flex flex-col items-center md:flex-row">
                            <div className="md:max-w-44 md:border-r md:border-[rgba(133,135,124,0.18)] md:pr-6">
                                <p className="text-end text-sm text-[#85877C]">Powering enterprise teams</p>
                            </div>
                            <div className="relative py-6 md:w-[calc(100%-11rem)]">
                                <InfiniteSlider speedOnHover={20} speed={40} gap={112}>
                                    <div className="flex items-center gap-2">
                                        <Brain className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">LangGraph</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Package className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">MCP Servers</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Target className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">OpenAI</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">Supabase</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileCheck className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">Next.js</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="h-5 w-5 text-[#85877C]" />
                                        <span className="text-sm font-medium text-[#85877C]">FastAPI</span>
                                    </div>
                                </InfiniteSlider>

                                <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0F0902]" />
                                <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0F0902]" />
                                <ProgressiveBlur
                                    className="pointer-events-none absolute left-0 top-0 h-full w-20"
                                    direction="left"
                                    blurIntensity={1}
                                />
                                <ProgressiveBlur
                                    className="pointer-events-none absolute right-0 top-0 h-full w-20"
                                    direction="right"
                                    blurIntensity={1}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="bg-[#0F0902] py-24">
                    <div className="mx-auto max-w-6xl px-6">
                        <div className="mb-16 text-center">
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#4A6FA8]">Capabilities</span>
                            <h2 className="mt-3 text-4xl font-bold tracking-tight text-[#FFFACC]">End-to-End Automation</h2>
                            <p className="mx-auto mt-4 max-w-xl text-[#85877C]">
                                From demand forecasting to PO approval — four specialized agents handle every step.
                            </p>
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { icon: Brain, title: 'Demand Analysis', desc: 'AI forecasts demand from historical data, seasonality, and market signals.', accent: '#4A6FA8' },
                                { icon: Target, title: 'Supplier Selection', desc: 'Scores and selects optimal suppliers based on quality, cost, and reliability.', accent: '#5D9975' },
                                { icon: Package, title: 'Container Optimization', desc: 'Maximizes container utilization to minimize freight costs per unit.', accent: '#C4883A' },
                                { icon: FileCheck, title: 'PO Compilation', desc: 'Auto-generates compliant purchase orders with full decision rationale.', accent: '#9D5C63' },
                                { icon: Users, title: 'Human-in-the-Loop', desc: 'Manager approval gate ensures oversight before any PO is finalized.', accent: '#4A6FA8' },
                                { icon: ShieldCheck, title: 'Full Audit Trail', desc: 'Every agent decision logged with inputs, outputs, and confidence scores.', accent: '#5D9975' },
                            ].map((f) => (
                                <div
                                    key={f.title}
                                    className="group/card rounded-2xl border border-[rgba(133,135,124,0.15)] bg-[#2F2504] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(133,135,124,0.35)]"
                                >
                                    <div
                                        className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                                        style={{ background: `${f.accent}20` }}
                                    >
                                        <f.icon className="h-5 w-5" style={{ color: f.accent }} />
                                    </div>
                                    <h3 className="mb-2 text-base font-bold text-[#FFFACC]">{f.title}</h3>
                                    <p className="text-sm leading-relaxed text-[#85877C]">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pipeline */}
                <section id="pipeline" className="bg-[#0F0902] py-24">
                    <div className="mx-auto max-w-4xl px-6">
                        <div className="mb-16 text-center">
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#9D5C63]">Architecture</span>
                            <h2 className="mt-3 text-4xl font-bold tracking-tight text-[#FFFACC]">Multi-Agent Pipeline</h2>
                            <p className="mx-auto mt-4 max-w-xl text-[#85877C]">
                                LangGraph orchestrates four specialized agents connected to MCP data servers.
                            </p>
                        </div>
                        <div className="relative flex flex-col">
                            <div className="absolute bottom-10 left-[30px] top-10 w-0.5 bg-gradient-to-b from-[#4A6FA8] to-[#9D5C63] opacity-30" />
                            {[
                                { agent: 'Demand Analyst', model: 'gpt-4o-mini', desc: 'Analyzes forecasts, inventory, and market data', accent: '#4A6FA8' },
                                { agent: 'Supplier Selector', model: 'gpt-4o-mini', desc: 'Scores and ranks suppliers for each SKU', accent: '#5D9975' },
                                { agent: 'Container Optimizer', model: 'gpt-4o-mini', desc: 'Packs items into containers for lowest freight', accent: '#C4883A' },
                                { agent: 'PO Compiler', model: 'gpt-4o-mini', desc: 'Generates final PO with full rationale', accent: '#9D5C63' },
                            ].map((step, i) => (
                                <div key={step.agent} className="flex items-center gap-6 py-5">
                                    <div
                                        className="relative z-10 flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full border-2"
                                        style={{ borderColor: step.accent, background: `${step.accent}20` }}
                                    >
                                        <span className="font-mono text-xl font-extrabold" style={{ color: step.accent }}>
                                            {i + 1}
                                        </span>
                                    </div>
                                    <div className="flex-1 rounded-xl border border-[rgba(133,135,124,0.15)] bg-[#2F2504] px-6 py-4">
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-[15px] font-bold text-[#FFFACC]">{step.agent}</span>
                                            <span className="rounded bg-[rgba(133,135,124,0.1)] px-2 py-0.5 font-mono text-[11px] text-[#85877C]">
                                                {step.model}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[#85877C]">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Stats */}
                <section id="results" className="bg-[rgba(47,37,4,0.5)] py-20">
                    <div className="mx-auto max-w-4xl px-6">
                        <div className="mb-12 text-center">
                            <h2 className="text-3xl font-extrabold tracking-tight text-[#FFFACC]">Built for Impact</h2>
                            <p className="mt-3 text-[#85877C]">Designed for the Cummins Xtern 2026 competition.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                            {[
                                { value: '87%', label: 'Faster PO Generation', desc: 'vs. manual process' },
                                { value: '99.2%', label: 'Container Utilization', desc: 'optimal packing' },
                                { value: '4x', label: 'Supplier Coverage', desc: 'evaluated per order' },
                                { value: '0', label: 'Unaudited Decisions', desc: 'full transparency' },
                            ].map((s) => (
                                <div key={s.label} className="rounded-2xl border border-[rgba(133,135,124,0.12)] bg-[#1A1006] p-7 text-center">
                                    <div className="bg-gradient-to-r from-[#4A6FA8] to-[#9D5C63] bg-clip-text font-mono text-4xl font-extrabold text-transparent">
                                        {s.value}
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-[#FFFACC]">{s.label}</div>
                                    <div className="mt-1 text-xs text-[#85877C]">{s.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section id="about" className="relative overflow-hidden py-24 text-center">
                    <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(43,65,98,0.25)_0%,transparent_70%)]" />
                    <div className="relative z-10 mx-auto max-w-2xl px-6">
                        <h2 className="text-4xl font-extrabold tracking-tight text-[#FFFACC]">Ready to automate procurement?</h2>
                        <p className="mx-auto mt-4 max-w-lg text-[#85877C]">
                            Launch the multi-agent pipeline and generate your first AI-driven purchase order in under 30 seconds.
                        </p>
                        <div className="mt-10">
                            <Button asChild size="lg" className="bg-gradient-to-r from-[#2B4162] to-[#9D5C63] px-10 text-base font-bold text-[#FFFACC] shadow-[0_0_50px_rgba(43,65,98,0.35)] hover:opacity-90">
                                <Link href="/pipeline">
                                    <span>Launch Pipeline</span>
                                    <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t border-[rgba(133,135,124,0.12)] py-10 text-center">
                    <div className="mb-5 flex flex-wrap justify-center gap-8">
                        {[
                            { href: '/', label: 'Dashboard' },
                            { href: '/pipeline', label: 'Pipeline' },
                            { href: '/approvals', label: 'Approvals' },
                            { href: '/suppliers', label: 'Suppliers' },
                            { href: '/logs', label: 'Decision Log' },
                            { href: '/agents', label: 'Agents' },
                        ].map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="text-sm text-[#85877C] transition-colors hover:text-[#FFFACC]">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                    <p className="text-xs text-[#85877C]">
                        ProcureAI &middot; Cummins Xtern 2026 &middot; Multi-Agent PO Automation
                    </p>
                </footer>
            </main>
        </>
    )
}

export default function LandingPage() {
    return <HeroMain />
}
