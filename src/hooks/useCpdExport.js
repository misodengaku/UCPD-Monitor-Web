// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';

/**
 * Custom hook for exporting captured data to .cpd files.
 */
export function useCpdExport() {
    const messages = useAppStore((s) => s.messages);

    /**
     * Convert messages to CPD binary format
     * @param {Array} messages - Array of captured messages
     * @returns {ArrayBuffer} - Binary data in CPD format
     */
    const convertToCpdFormat = useCallback((messages) => {
        // Calculate total size needed
        let totalSize = 0;
        const records = [];

        // Process each message
        for (const msg of messages) {
            // Process PD_MSG, ASCII_LOG (DEBUG), and EVENT type messages from webserial or STM32
            if (msg.source !== 'webserial' && msg.source !== 'STM32') continue;
            if (!msg.recordType || (msg.recordType !== 'PD_MSG' && msg.recordType !== 'ASCII_LOG' && msg.recordType !== 'EVENT')) continue;

            // Handle different record types
            let bytes = [];
            if (msg.recordType === 'PD_MSG') {
                // Parse hex string to bytes for PD_MSG
                const hexBytes = msg.raw.trim().split(' ');
                bytes = hexBytes.map(h => parseInt(h, 16)).filter(b => !isNaN(b));

                // Skip invalid messages
                if (bytes.length < 2) continue;
            } else if (msg.recordType === 'ASCII_LOG') {
                // For ASCII_LOG, we'll encode the string directly in the payload section
                // No need to pre-process bytes here
            } else if (msg.recordType === 'EVENT') {
                // For EVENT, no payload bytes needed
            }

            // For PD_MSG, calculate payload length normally
            // For ASCII_LOG and EVENT, use pre-defined structures
            let payloadLen, catByte, dirByte, sopQual;
            if (msg.recordType === 'PD_MSG') {
                payloadLen = bytes.length;
                catByte = payloadLen + 9;
                dirByte = msg.cpd?.dir || (msg.header?.portPowerRole === 'Source' ? 0x07 : 0x08);
                sopQual = msg.cpd?.sopQual || 0x00;
            } else if (msg.recordType === 'ASCII_LOG') {
                payloadLen = (msg.asciiLog || msg.raw).length;
                catByte = payloadLen + 9;
                dirByte = 0x06; // DEBUG
                sopQual = 0x00;
            } else if (msg.recordType === 'EVENT') {
                payloadLen = 0;
                catByte = 0x09; // Special case for EVENT
                dirByte = 0x03; // EVENT
                sopQual = msg.cpd?.sopQual || 0x00;
            }

            // Create CPD record with proper structure
            // Header: 16 bytes + payload + 4 byte sentinel = 20 + payloadLen bytes total
            const recordLength = 20 + payloadLen;
            const record = new Uint8Array(recordLength);

            // Sync bytes (0-3)
            record[0] = 0xFD;
            record[1] = 0xFD;
            record[2] = 0xFD;
            record[3] = 0xFD;

            // Fixed field (4-5)
            record[4] = 0x32;
            record[5] = 0x00;

            // Category byte (6)
            record[6] = catByte;

            // Direction (7)
            record[7] = dirByte;

            // Timestamp (8-11) - using message timestamp or current time
            const timestamp = (msg.ts || Date.now()) & 0xFFFFFFFF;
            record[8] = timestamp & 0xFF;
            record[9] = (timestamp >> 8) & 0xFF;
            record[10] = (timestamp >> 16) & 0xFF;
            record[11] = (timestamp >> 24) & 0xFF;

            // Padding (12)
            record[12] = 0x00;

            // SOP Qual (13)
            record[13] = sopQual;

            // Padding (14)
            record[14] = 0x00;

            // Payload length (15)
            record[15] = payloadLen;

            // Payload (16 to 16+payloadLen-1)
            if (msg.recordType === 'PD_MSG') {
                record.set(bytes, 16);
            } else if (msg.recordType === 'ASCII_LOG') {
                // For ASCII_LOG, encode the string
                const encoder = new TextEncoder();
                const rawBytes = encoder.encode(msg.asciiLog || msg.raw);
                record.set(rawBytes, 16);
            }
            // For EVENT, no payload to set

            // Sentinel (last 4 bytes)
            const sentinelStart = 16 + payloadLen;
            record[sentinelStart] = 0xA5;
            record[sentinelStart + 1] = 0xA5;
            record[sentinelStart + 2] = 0xA5;
            record[sentinelStart + 3] = 0xA5;

            records.push(record);
            totalSize += record.length;
        }

        // Create final buffer
        const buffer = new ArrayBuffer(totalSize);
        const view = new Uint8Array(buffer);

        // Copy all records
        let offset = 0;
        for (const record of records) {
            view.set(record, offset);
            offset += record.length;
        }

        return buffer;
    }, []);

    /**
     * Export captured data to a .cpd file
     */
    const exportCpdFile = useCallback(() => {
        // Check if there are any messages to export
        if (messages.length === 0) {
            useAppStore.getState().appendLog('[Export] No messages to export');
            return;
        }

        try {
            // Convert messages to CPD format
            const binaryData = convertToCpdFormat(messages);

            // Create blob and download
            const blob = new Blob([binaryData], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);

            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = `capture_${new Date().toISOString().replace(/[:.]/g, '-')}.cpd`;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        } catch (error) {
            console.error('Error exporting CPD file:', error);
            useAppStore.getState().appendLog(`[Export] Error: ${error.message}`);
        }
    }, [messages, convertToCpdFormat]);

    return { exportCpdFile };
}