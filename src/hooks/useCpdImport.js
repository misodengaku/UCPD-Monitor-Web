// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { useStaticData } from './useStaticData';

/** True when running inside Electron with preload.js loaded. */
const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI?.openFileDialog;

/** Last-used directory handle for browser "Import" fallback (session-scoped). */
let lastDirHandle = null;

/**
 * Hook for importing .cpd binary log files.
 *
 * Features:
 *   - Single or multiple files via file picker dialog
 *   - Drag-and-drop (pass FileList / File[] to importFiles)
 *   - All files are parsed concurrently, then merged and sorted by timestamp
 *   - Progress state is reported through appStore.importStatus
 */
export function useCpdImport() {
  const { appendLog, setImportStatus } = useAppStore();
  const { parseCpdFileData } = useStaticData();

  /**
   * Parse one or more .cpd files directly in the browser.
   * Multiple files are processed sequentially.
   *
   * @param {File[] | FileList} files
   */
  const importFiles = useCallback(
    async (files) => {
      const fileList = Array.from(files).filter(Boolean);
      if (fileList.length === 0) return;

      const names = fileList.map((f) => f.name).join(', ');
      appendLog(`[Import] Processing ${fileList.length} file(s): ${names}`);
      setImportStatus({ loading: true, filename: names, done: 0, total: fileList.length, warnings: 0 });

      try {
        // Process files sequentially
        let totalRecords = 0;
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i];
          const result = await parseCpdFileData(file);
          if (result.success) {
            totalRecords += result.frames;
            setImportStatus(prev => ({
              ...prev,
              done: i + 1,
              total: fileList.length
            }));
          } else {
            throw new Error(result.error);
          }
        }

        setImportStatus({ loading: false, done: fileList.length, warnings: 0 });
        appendLog(`[Import] Done — ${totalRecords} record(s) from ${fileList.length} file(s)`);
      } catch (err) {
        appendLog(`[Import] Error: ${err.message}`);
        setImportStatus({ loading: false });
      }
    },
    [appendLog, setImportStatus, parseCpdFileData]
  );

  /** Shared Electron path-based import helper. */
  const _importByPaths = useCallback(async (filePaths) => {
    // In static version, we can't access file paths directly
    // This functionality is not available in pure browser environment
    appendLog(`[Import] Path-based import not available in static version`);
    setImportStatus({ loading: false });
  }, [appendLog, setImportStatus]);

  /**
   * ".cpd Open" — opens the logs directory where session files are saved.
   * - Electron: dialog.showOpenDialog with defaultPath = logs dir.
   * - Browser:  showOpenFilePicker with startIn='downloads' (closest approximation).
   */
  const openLogsFilePicker = useCallback(() => {
    if (isElectron()) {
      window.electronAPI.openFileDialog().then((filePaths) => _importByPaths(filePaths));
    } else if (typeof window.showOpenFilePicker === 'function') {
      window.showOpenFilePicker({
        multiple: true,
        startIn: 'downloads',
        types: [{ description: 'CPD Files', accept: { 'application/octet-stream': ['.cpd'] } }],
      }).then(async (handles) => {
        const files = await Promise.all(handles.map((h) => h.getFile()));
        if (files.length) importFiles(files);
      }).catch(() => {/* cancelled */});
    } else {
      _inputFilePicker(importFiles);
    }
  }, [importFiles, _importByPaths]);

  /**
   * ".cpd Import" — opens at the last used folder (OS remembers in Electron;
   * browser session remembers via stored FileSystemDirectoryHandle).
   * - Electron: dialog.showOpenDialog without defaultPath.
   * - Browser:  showOpenFilePicker with startIn=lastDirHandle (or 'downloads').
   */
  const openImportFilePicker = useCallback(() => {
    if (isElectron()) {
      window.electronAPI.openFileDialogFree().then((filePaths) => _importByPaths(filePaths));
    } else if (typeof window.showOpenFilePicker === 'function') {
      const opts = {
        multiple: true,
        types: [{ description: 'CPD Files', accept: { 'application/octet-stream': ['.cpd'] } }],
      };
      if (lastDirHandle) opts.startIn = lastDirHandle;
      window.showOpenFilePicker(opts).then(async (handles) => {
        // Remember the directory of the first picked file for next time
        if (handles.length > 0) {
          try { lastDirHandle = await handles[0].getParent?.(); } catch { /* ignore */ }
        }
        const files = await Promise.all(handles.map((h) => h.getFile()));
        if (files.length) importFiles(files);
      }).catch(() => {/* cancelled */});
    } else {
      _inputFilePicker(importFiles);
    }
  }, [importFiles, _importByPaths]);

  return { openLogsFilePicker, openImportFilePicker, importFiles };
}

/** Fallback: hidden <input type="file"> for browsers without showOpenFilePicker. */
function _inputFilePicker(importFiles) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.cpd,application/octet-stream';
  input.multiple = true;
  input.style.display = 'none';
  input.onchange = (e) => {
    if (e.target.files?.length) importFiles(e.target.files);
    document.body.removeChild(input);
  };
  document.body.appendChild(input);
  input.click();
}

