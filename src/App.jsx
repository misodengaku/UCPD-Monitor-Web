// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useCallback, useState } from 'react';
import { useStaticData } from './hooks/useStaticData';
import { useCpdImport } from './hooks/useCpdImport';
import { useCpdExport } from './hooks/useCpdExport';
import { useAppStore } from './store/appStore';
const useSerialConnected = () => useAppStore((s) => s.serialStatus.connected);
import TopologyView from './components/TopologyView';
import MessageTable from './components/MessageTable';
import Console from './components/Console';
import SerialBar from './components/SerialBar';
import styles from './App.module.css';


function ImportBadge() {
  const { loading, done, total, warnings } = useAppStore((s) => s.importStatus);
  if (loading) {
    return <span className={styles.importBadge}>⏳ Loading…</span>;
  }
  if (done > 0) {
    return (
      <span className={styles.importBadge}>
        ✓ {done} file{done > 1 ? 's' : ''}
        {warnings > 0 && <span className={styles.importWarn}> ⚠ {warnings}</span>}
      </span>
    );
  }
  return null;
}

export default function App() {
  const { sendPing, sendMessage } = useStaticData();
  const { openLogsFilePicker, openImportFilePicker, importFiles } = useCpdImport();
  const { exportCpdFile } = useCpdExport();
  const serialConnected = useSerialConnected();
  const messages = useAppStore((s) => s.messages);
  const [dragging, setDragging] = useState(false);
  const [showTopology, setShowTopology] = useState(true);
  const [showConsole, setShowConsole] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(null); // 'topology', 'messages', or 'console'

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    // Only clear when leaving the root element entirely
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.cpd') || f.type === 'application/octet-stream' || f.type === ''
    );
    if (files.length) importFiles(files);
  }, [importFiles]);

  // パネルの拡張表示を切り替える関数
  const toggleExpandedPanel = useCallback((panelName) => {
    setExpandedPanel(expandedPanel === panelName ? null : panelName);
  }, [expandedPanel]);

  // パネルの通常表示を切り替える関数
  const togglePanel = useCallback((panelName) => {
    if (panelName === 'topology') {
      setShowTopology(v => !v);
    } else if (panelName === 'console') {
      setShowConsole(v => !v);
    }
  }, []);

  return (
    <div
      className={styles.app}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drag-and-drop overlay */}
      {dragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropOverlayInner}>
            <span className={styles.dropIcon}>📂</span>
            <span>Drop .cpd files here</span>
          </div>
        </div>
      )}

      {/* Title bar — also hosts serial port controls */}
      <header className={styles.titleBar}>
        <span className={styles.title}>
          UCPD-Monitor
          <span className={styles.titleVersion}>v{import.meta.env.VITE_APP_VERSION}</span>
        </span>
        <ImportBadge />

        {/* デスクトップ表示用コントロール */}
        <div className={styles.desktopControls}>
          <button
            onClick={openLogsFilePicker}
            className={styles.importBtn}
            disabled={serialConnected}
            title={serialConnected ? 'Disconnect DISCO before importing a .cpd file' : 'Open from logs folder'}
          >.cpd Open</button>
          <button
            onClick={openImportFilePicker}
            className={styles.importBtn}
            disabled={serialConnected}
            title={serialConnected ? 'Disconnect DISCO before importing a .cpd file' : 'Import from last used folder'}
          >.cpd Import</button>
          <button
            onClick={exportCpdFile}
            className={styles.exportBtn}
            title="Export captured data to .cpd file"
            disabled={messages.length === 0}
          >.cpd Export</button>
          <button onClick={sendPing} className={styles.pingBtn} style={{ display: 'none' }}>Ping</button>
          <button
            className={`${styles.panelToggleBtn} ${showTopology ? styles.panelToggleActive : ''}`}
            onClick={() => togglePanel('topology')}
            title="Toggle Connection View panel"
          >Connection View</button>
          <button
            className={`${styles.panelToggleBtn} ${showConsole ? styles.panelToggleActive : ''}`}
            onClick={() => togglePanel('console')}
            title="Toggle Console panel"
          >Console</button>
          <SerialBar sendMessage={sendMessage} />
        </div>

        {/* モバイル表示用ハンバーガーメニュー */}
        <div className={styles.hamburgerMenu}>
          <button
            className={styles.hamburgerButton}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >☰</button>
          <div className={`${styles.menuContent} ${showMobileMenu ? styles.show : ''}`}>
            <button
              onClick={openLogsFilePicker}
              className={styles.menuItem}
              disabled={serialConnected}
              title={serialConnected ? 'Disconnect DISCO before importing a .cpd file' : 'Open from logs folder'}
            >.cpd Open</button>
            <button
              onClick={openImportFilePicker}
              className={styles.menuItem}
              disabled={serialConnected}
              title={serialConnected ? 'Disconnect DISCO before importing a .cpd file' : 'Import from last used folder'}
            >.cpd Import</button>
            <button
              onClick={exportCpdFile}
              className={styles.menuItem}
              title="Export captured data to .cpd file"
              disabled={messages.length === 0}
            >.cpd Export</button>
            <button onClick={sendPing} className={styles.menuItem} style={{ display: 'none' }}>Ping</button>
            <div className={styles.menuSeparator}></div>
            <button
              className={`${styles.menuItem} ${showTopology ? styles.panelToggleActive : ''}`}
              onClick={() => togglePanel('topology')}
              title="Toggle Connection View panel"
            >Connection View</button>
            <button
              className={`${styles.menuItem} ${showConsole ? styles.panelToggleActive : ''}`}
              onClick={() => togglePanel('console')}
              title="Toggle Console panel"
            >Console</button>
            <div className={styles.menuSeparator}></div>
            <SerialBar sendMessage={sendMessage} />
          </div>
        </div>
      </header >

      {/* Connection View panel */}
      < div className={`${styles.panelContent} ${expandedPanel === 'topology' ? styles.expanded : ''}`
      }>
        <div
          className={styles.panelHeader}
          onClick={() => toggleExpandedPanel('topology')}
        >
          <span>Connection View</span>
          <span>{expandedPanel === 'topology' ? '▼' : '▲'}</span>
        </div>
        {
          showTopology && (
            <div className={styles.panelContainer}>
              <TopologyView />
            </div>
          )
        }
      </div >

      {/* Message Log panel */}
      < div className={`${styles.panelContent} ${expandedPanel === 'messages' ? styles.expanded : ''}`}>
        <div
          className={styles.panelHeader}
          onClick={() => toggleExpandedPanel('messages')}
        >
          <span>Message Log</span>
          <span>{expandedPanel === 'messages' ? '▼' : '▲'}</span>
        </div>
        <div className={styles.panelContainer}>
          <MessageTable />
        </div>
      </div >

      {/* Console panel */}
      < div className={`${styles.panelContent} ${expandedPanel === 'console' ? styles.expanded : ''}`}>
        <div
          className={styles.panelHeader}
          onClick={() => toggleExpandedPanel('console')}
        >
          <span>Console</span>
          <span>{expandedPanel === 'console' ? '▼' : '▲'}</span>
        </div>
        {
          showConsole && (
            <div className={styles.panelContainer}>
              <div className={styles.consoleArea}>
                <Console />
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
}
