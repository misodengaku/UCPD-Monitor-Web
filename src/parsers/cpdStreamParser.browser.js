// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO

// Browser-compatible version of CpdStreamParser
// Adapted from server/cpdStreamParser.js for use in the browser

// CPD frame constants (mirrors pd_parser.js)
const SYNC_BYTE      = 0xFD;
const SYNC_LENGTH    = 4;        // FD FD FD FD
const HEADER_LENGTH  = 12;       // bytes 4-15 after sync word
const SENTINEL_LEN   = 4;        // A5 A5 A5 A5  (or variant)
const PAYLOAD_LEN_OFFSET = 15;   // absolute offset from frame start

/**
 * Browser-compatible class that ingests raw serial bytes and emits complete CPD records.
 *
 * Each emitted event is an ArrayBuffer containing one full raw CPD record:
 *   [FD FD FD FD] [12-byte header] [payloadLen bytes] [4-byte sentinel]
 *   = 20 + payloadLen bytes total
 *
 * Usage:
 *   const parser = new CpdStreamParser();
 *   parser.on('frame', (arrayBuffer) => { ... });
 *   // Feed data to parser
 */
export class CpdStreamParser {
  constructor() {
    this._buffer = new Uint8Array(0);
    this._listeners = {};
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(callback => callback(data));
    }
  }

  /**
   * Write data to the parser
   */
  write(data) {
    // Convert input to Uint8Array if needed
    let newData;
    if (data instanceof ArrayBuffer) {
      newData = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      newData = data;
    } else if (Array.isArray(data)) {
      newData = new Uint8Array(data);
    } else {
      throw new Error('Unsupported data type');
    }

    // Append incoming bytes to internal accumulation buffer
    const newBuffer = new Uint8Array(this._buffer.length + newData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(newData, this._buffer.length);
    this._buffer = newBuffer;

    this._processBuffer();
  }

  /**
   * End the stream
   */
  end() {
    // Stream ended — discard any partial frame
    this._buffer = new Uint8Array(0);
  }

  /**
   * Process the buffer
   */
  _processBuffer() {
    while (true) {
      // 1. Find sync word FD FD FD FD
      const syncIdx = this._findSync();
      if (syncIdx === -1) {
        // No sync found — keep last 3 bytes in case sync straddles chunk boundaries
        if (this._buffer.length > 3) {
          this._buffer = this._buffer.slice(this._buffer.length - 3);
        }
        return;
      }

      // Discard bytes before sync
      if (syncIdx > 0) {
        this._buffer = this._buffer.slice(syncIdx);
      }

      // 2. Wait until we have enough bytes to read payloadLen (at offset 15)
      if (this._buffer.length < PAYLOAD_LEN_OFFSET + 1) return;

      const payloadLen  = this._buffer[PAYLOAD_LEN_OFFSET];
      const frameLength = SYNC_LENGTH + HEADER_LENGTH + payloadLen + SENTINEL_LEN; // 20 + payloadLen

      // 3. Wait for the complete frame
      if (this._buffer.length < frameLength) return;

      // 4. Extract and emit the frame
      const frame = this._buffer.slice(0, frameLength);
      this._buffer = this._buffer.slice(frameLength);

      // Emit as ArrayBuffer to match server behavior
      this.emit('frame', frame.buffer);
    }
  }

  /**
   * Find the first occurrence of [FD FD FD FD] in _buffer.
   * Returns index, or -1 if not found.
   */
  _findSync() {
    const b = this._buffer;
    for (let i = 0; i <= b.length - SYNC_LENGTH; i++) {
      if (b[i] === SYNC_BYTE && b[i + 1] === SYNC_BYTE && b[i + 2] === SYNC_BYTE && b[i + 3] === SYNC_BYTE) {
        return i;
      }
    }
    return -1;
  }
}