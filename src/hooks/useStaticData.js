// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { parseRawFrame, parseCpdFile, isUndecodedMessage, buildUnknownRecord } from '../parsers/pd_parser';
import { CpdStreamParser } from '../parsers/cpdStreamParser.browser';

/**
 * Custom hook that provides static data functionality.
 * Replaces the WebSocket hook for static deployment.
 */
export function useStaticData() {
  const { 
    setWsStatus, 
    setSerialStatus, 
    hexDump, 
    addMessage, 
    appendLog, 
    applyFrame, 
    clearMessages, 
    setMessages, 
    replayFrames 
  } = useAppStore();

  /**
   * Parse a CPD file and process its contents
   */
  const parseCpdFileData = useCallback(async (file) => {
    try {
      setWsStatus('connecting');
      appendLog(`[Static] Parsing file: ${file.name}...`);

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Parse directly — no ring buffer involved
      const records = [];
      const parser = new CpdStreamParser();
      parser.on('frame', (buf) => {
        const hex = Array.from(new Uint8Array(buf))
          .map(b => b.toString(16).padStart(2, '0').toUpperCase())
          .join(' ');
        records.push({ hex, ts: Date.now() });
      });
      parser.write(arrayBuffer);
      parser.end();

      appendLog(`[Static] Parsed ${records.length} record(s) from "${file.name}"`);

      // Process records
      const allFrames = [];
      const unknowns = [];
      
      for (const rec of records) {
        try {
          const bytes = Uint8Array.from(rec.hex.split(' ').map((b) => parseInt(b, 16)));
          const { frames } = parseCpdFile(bytes.buffer);
          for (const frame of frames) {
            allFrames.push(frame);
            if (isUndecodedMessage(frame.header)) {
              unknowns.push(buildUnknownRecord(frame, 'file'));
            }
          }
        } catch (e) {
          console.error('Error parsing record:', e);
        }
      }

      // Update UI
      clearMessages();
      setMessages(allFrames);
      replayFrames(allFrames);

      setWsStatus('connected');
      appendLog(`[Static] Loaded ${allFrames.length} frame(s) from "${file.name}"`);

      return { success: true, frames: allFrames.length };
    } catch (error) {
      setWsStatus('error');
      appendLog(`[Static] Error parsing file: ${error.message}`);
      return { success: false, error: error.message };
    }
  }, [setWsStatus, appendLog, clearMessages, setMessages, replayFrames]);

  /**
   * Process raw hex data (from WebSerial or other sources)
   */
  const processRawData = useCallback((hex, source = 'unknown') => {
    try {
      if (hexDump) appendLog(`[HEX] ${hex}`);
      
      const bytes = Uint8Array.from(
        hex.split(' ').map((b) => parseInt(b, 16))
      );
      
      const { frames } = parseCpdFile(bytes.buffer);
      const unknowns = [];
      
      for (const frame of frames) {
        addMessage(frame);
        applyFrame(frame);
        
        if (frame.parseViolations?.length) {
          const id = frame.header?.typeName ?? 'frame';
          for (const v of frame.parseViolations) {
            appendLog(`[ERROR] [Parser] ${id}: ${v}`);
          }
        }
        
        if (isUndecodedMessage(frame.header)) {
          unknowns.push(buildUnknownRecord(frame, source));
        }
      }
      
      if (unknowns.length) {
        // In static version, we just log unknown records instead of sending to server
        console.log('Unknown records:', unknowns);
      }
      
      return { success: true, frames: frames.length };
    } catch (e) {
      appendLog(`[Static] Raw data parse error: ${e.message}`);
      return { success: false, error: e.message };
    }
  }, [addMessage, appendLog, applyFrame, hexDump]);

  /**
   * Simulate sending a ping (no-op in static version)
   */
  const sendPing = useCallback(() => {
    // In static version, ping does nothing
    console.log('[Static] Ping (no-op in static version)');
  }, []);

  /**
   * Simulate sending a message (no-op in static version)
   */
  const sendMessage = useCallback((msg) => {
    // In static version, we handle messages differently
    console.log('[Static] Message (no-op in static version):', msg);
  }, []);

  return { 
    parseCpdFileData, 
    processRawData, 
    sendPing, 
    sendMessage 
  };
}