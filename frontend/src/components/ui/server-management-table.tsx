"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Power, Pause, Play, RotateCcw, Monitor, Terminal, Cpu, Server } from "lucide-react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

export interface ServerItem {
  id: string;
  number: string;
  serviceName: string;
  osType: "windows" | "linux" | "ubuntu";
  serviceLocation: string;
  countryCode: "de" | "us" | "fr" | "jp";
  ip: string;
  dueDate: string;
  cpuPercentage: number;
  status: "active" | "paused" | "inactive";
}

interface ServerManagementTableProps {
  title?: string;
  servers?: ServerItem[];
  onStatusChange?: (serverId: string, newStatus: ServerItem["status"]) => void;
  className?: string;
}

const defaultServers: ServerItem[] = [
  {
    id: "1",
    number: "01",
    serviceName: "VPS-2 (Windows)",
    osType: "windows",
    serviceLocation: "Frankfurt, Germany",
    countryCode: "de",
    ip: "198.51.100.211",
    dueDate: "14 Oct 2027",
    cpuPercentage: 80,
    status: "active",
  },
  {
    id: "2",
    number: "02",
    serviceName: "VPS-1 (Windows)",
    osType: "windows",
    serviceLocation: "Frankfurt, Germany",
    countryCode: "de",
    ip: "203.0.113.158",
    dueDate: "14 Oct 2027",
    cpuPercentage: 90,
    status: "active",
  },
  {
    id: "3",
    number: "03",
    serviceName: "VPS-1 (Ubuntu)",
    osType: "ubuntu",
    serviceLocation: "Paris, France",
    countryCode: "fr",
    ip: "192.0.2.37",
    dueDate: "27 Jun 2027",
    cpuPercentage: 50,
    status: "paused",
  },
  {
    id: "4",
    number: "04",
    serviceName: "Cloud Server (Ubuntu)",
    osType: "ubuntu",
    serviceLocation: "California, US West",
    countryCode: "us",
    ip: "198.51.100.23",
    dueDate: "30 May 2030",
    cpuPercentage: 95,
    status: "active",
  },
  {
    id: "5",
    number: "05",
    serviceName: "Dedicated Server (Windows)",
    osType: "windows",
    serviceLocation: "Virginia, US East",
    countryCode: "us",
    ip: "203.0.113.45",
    dueDate: "15 Dec 2026",
    cpuPercentage: 25,
    status: "inactive",
  },
];

const countryFlags: Record<string, string> = {
  de: "🇩🇪",
  us: "🇺🇸",
  fr: "🇫🇷",
  jp: "🇯🇵",
};

export function ServerManagementTable({
  title = "Active Services",
  servers: initialServers = defaultServers,
  onStatusChange,
  className = "",
}: ServerManagementTableProps = {}) {
  const [servers, setServers] = useState<ServerItem[]>(initialServers);
  const [hoveredServer, setHoveredServer] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const handleStatusChange = (serverId: string, newStatus: ServerItem["status"]) => {
    onStatusChange?.(serverId, newStatus);
    setServers((prev) =>
      prev.map((s) => (s.id === serverId ? { ...s, status: newStatus } : s))
    );
  };

  const selectedServer = selectedServerId
    ? servers.find((s) => s.id === selectedServerId) ?? null
    : null;

  const getOSIcon = (osType: ServerItem["osType"]) => {
    const iconClass = "w-4 h-4 text-white";
    const configs = {
      windows: { from: "from-blue-500", to: "to-blue-600", Icon: Monitor },
      linux: { from: "from-yellow-500", to: "to-orange-500", Icon: Terminal },
      ubuntu: { from: "from-orange-500", to: "to-red-500", Icon: Terminal },
    };
    const { from, to, Icon } = configs[osType] ?? configs.windows;
    return (
      <div
        className={cn(
          "w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center border border-white/10",
          from,
          to
        )}
      >
        <Icon className={iconClass} strokeWidth={1.5} />
      </div>
    );
  };

  const getCPUBarColor = (pct: number) => {
    if (pct >= 90) return "#ef4444";
    if (pct >= 70) return "#f59e0b";
    return "#10b981";
  };

  const getStatusStyle = (status: ServerItem["status"]) => {
    const map = {
      active: { bg: "rgba(16,185,129,0.15)", color: "#10b981", border: "rgba(16,185,129,0.3)" },
      paused: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
      inactive: { bg: "rgba(100,116,139,0.15)", color: "#64748b", border: "rgba(100,116,139,0.3)" },
    };
    return map[status];
  };

  return (
    <div
      className={cn("w-full rounded-xl overflow-hidden", className)}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Server style={{ width: 16, height: 16, color: "var(--accent-blue)" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
            {title}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "2px 10px",
          }}
        >
          {servers.length} services
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["#", "Service", "IP Address", "Location", "Due Date", "CPU", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 16px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => {
              const statusStyle = getStatusStyle(server.status);
              const isHovered = hoveredServer === server.id;
              return (
                <motion.tr
                  key={server.id}
                  onHoverStart={() => setHoveredServer(server.id)}
                  onHoverEnd={() => setHoveredServer(null)}
                  animate={{ backgroundColor: isHovered ? "rgba(255,255,255,0.02)" : "transparent" }}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedServerId(server.id)}
                >
                  {/* Number */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span
                      className="mono"
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}
                    >
                      {server.number}
                    </span>
                  </td>

                  {/* Service name + OS icon */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {getOSIcon(server.osType)}
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        {server.serviceName}
                      </span>
                    </div>
                  </td>

                  {/* IP */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {server.ip}
                    </span>
                  </td>

                  {/* Location */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>
                        {countryFlags[server.countryCode] ?? "🌐"}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {server.serviceLocation}
                      </span>
                    </div>
                  </td>

                  {/* Due date */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span
                      className="mono"
                      style={{ fontSize: 12, color: "var(--text-secondary)" }}
                    >
                      {server.dueDate}
                    </span>
                  </td>

                  {/* CPU bar */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 80 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: "var(--border)",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${server.cpuPercentage}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          style={{
                            height: "100%",
                            background: getCPUBarColor(server.cpuPercentage),
                            borderRadius: 2,
                          }}
                        />
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: getCPUBarColor(server.cpuPercentage),
                          width: 32,
                          textAlign: "right",
                        }}
                      >
                        {server.cpuPercentage}%
                      </span>
                    </div>
                  </td>

                  {/* Status badge */}
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "2px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        border: `1px solid ${statusStyle.border}`,
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: statusStyle.color,
                          display: "inline-block",
                        }}
                      />
                      {server.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {/* Toggle pause/play */}
                      <button
                        title={server.status === "paused" ? "Resume" : "Pause"}
                        onClick={() =>
                          handleStatusChange(
                            server.id,
                            server.status === "paused" ? "active" : "paused"
                          )
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {server.status === "paused" ? (
                          <Play style={{ width: 12, height: 12 }} />
                        ) : (
                          <Pause style={{ width: 12, height: 12 }} />
                        )}
                      </button>

                      {/* Power toggle */}
                      <button
                        title={server.status === "inactive" ? "Power On" : "Power Off"}
                        onClick={() =>
                          handleStatusChange(
                            server.id,
                            server.status === "inactive" ? "active" : "inactive"
                          )
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: server.status === "inactive" ? "#10b981" : "#ef4444",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Power style={{ width: 12, height: 12 }} />
                      </button>

                      {/* Restart */}
                      <button
                        title="Restart"
                        onClick={() => {
                          handleStatusChange(server.id, "paused");
                          setTimeout(() => handleStatusChange(server.id, "active"), 800);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--bg-surface)",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <RotateCcw style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedServer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
            onClick={() => setSelectedServerId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: 16,
                padding: 28,
                maxWidth: 480,
                width: "100%",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {getOSIcon(selectedServer.osType)}
                  <div>
                    <div
                      style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}
                    >
                      {selectedServer.serviceName}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      #{selectedServer.number}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedServerId(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Detail rows */}
              {[
                { label: "IP Address", value: selectedServer.ip },
                {
                  label: "Location",
                  value: `${countryFlags[selectedServer.countryCode] ?? "🌐"} ${selectedServer.serviceLocation}`,
                },
                { label: "Due Date", value: selectedServer.dueDate },
                { label: "OS Type", value: selectedServer.osType.charAt(0).toUpperCase() + selectedServer.osType.slice(1) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {value}
                  </span>
                </div>
              ))}

              {/* CPU */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  <Cpu style={{ width: 12, height: 12 }} /> CPU Usage
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 100,
                      height: 6,
                      background: "var(--border)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${selectedServer.cpuPercentage}%`,
                        background: getCPUBarColor(selectedServer.cpuPercentage),
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: getCPUBarColor(selectedServer.cpuPercentage),
                    }}
                  >
                    {selectedServer.cpuPercentage}%
                  </span>
                </div>
              </div>

              {/* Actions row */}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button
                  onClick={() =>
                    handleStatusChange(
                      selectedServer.id,
                      selectedServer.status === "paused" ? "active" : "paused"
                    )
                  }
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {selectedServer.status === "paused" ? (
                    <><Play style={{ width: 13, height: 13 }} /> Resume</>
                  ) : (
                    <><Pause style={{ width: 13, height: 13 }} /> Pause</>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleStatusChange(
                      selectedServer.id,
                      selectedServer.status === "inactive" ? "active" : "inactive"
                    )
                  }
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: `1px solid ${selectedServer.status === "inactive" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                    background: selectedServer.status === "inactive" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: selectedServer.status === "inactive" ? "#10b981" : "#ef4444",
                    cursor: "pointer",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Power style={{ width: 13, height: 13 }} />
                  {selectedServer.status === "inactive" ? "Power On" : "Power Off"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
