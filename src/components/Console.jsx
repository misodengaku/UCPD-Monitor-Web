// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import styles from './Console.module.css';

export default function Console() {
  const consoleLogs = useAppStore((s) => s.consoleLogs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const bottomRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs, collapsed]);

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <section className={styles.console}>
      <header className={styles.header}>
        <span>Console</span>
        <div>
          <button onClick={toggleCollapse} className={styles.toggleBtn}>
            {collapsed ? '▼' : '▲'}
          </button>
          {!collapsed && (
            <button onClick={clearLogs} className={styles.clearBtn}>Clear</button>
          )}
        </div>
      </header>
      {!collapsed && (
        <div className={styles.log}>
          {consoleLogs.map((line, i) => {
            const cls = line.includes('[ERROR]') ? styles.lineError
              : line.includes('[WARN]') ? styles.lineWarn
                : styles.line;
            return <div key={i} className={cls}>{line}</div>;
          })}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}
