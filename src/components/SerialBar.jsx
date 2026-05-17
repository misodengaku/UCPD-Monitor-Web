// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useStaticData } from '../hooks/useStaticData';
import styles from './SerialBar.module.css';
import appStyles from '../App.module.css';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]; // eslint-disable-line no-unused-vars
// Note: baud rate is meaningless for USB-CDC devices; kept only for non-CDC fallback.
// The firmware uses the CDC SET_LINE_CODING baud rate as a magic number to switch
// into CPD streaming mode.  921600 triggers the stream; other values do not.
const USB_CDC_BAUD = 921600;

/**
 * SerialBar — toolbar widget for serial port selection and connection.
 * Port list is pushed from the server via WebSocket (PORT_LIST messages).
 * Sends SERIAL_CONNECT / SERIAL_DISCONNECT / GET_PORT_LIST commands via WS.
 * Never auto-connects — user must press Connect explicitly.
 */
export default function SerialBar({ sendMessage }) {
  // In static version, we use the static data hook for processing
  const { processRawData } = useStaticData();
  const serialStatus = useAppStore((s) => s.serialStatus);
  const ports = useAppStore((s) => s.serialPorts);

  const [webSerialPort, setWebSerialPort] = useState(null);

  // Buffering for WebSerial data
  const dataBuffer = useRef('');
  const bufferTimer = useRef(null);
  const lastDataTime = useRef(0);
  const readerRef = useRef(null);

  // Clear buffer timer on unmount
  useEffect(() => {
    return () => {
      if (bufferTimer.current) {
        clearInterval(bufferTimer.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(() => {
    // For WebSerial, we don't need to refresh the port list
    return;
  }, []);

  const handleConnect = useCallback(async () => {
    // WebSerial connection
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: USB_CDC_BAUD });
      setWebSerialPort(port);

      // Read data from the port
      const reader = port.readable.getReader();
      readerRef.current = reader;

      // Process buffered data
      const processBuffer = () => {
        // Only process if there's data in the buffer
        if (dataBuffer.current.length > 0) {
          // Check if we haven't received data for a while (150ms)
          if (Date.now() - lastDataTime.current > 150) {
            // Process the buffer
            processRawData(dataBuffer.current.trim(), 'webserial');
            // Clear the buffer
            dataBuffer.current = '';
          }
        }
      };

      // Start buffer processing timer
      if (bufferTimer.current) {
        clearInterval(bufferTimer.current);
      }
      bufferTimer.current = setInterval(processBuffer, 100); // Process buffer every 100ms

      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            // Convert bytes to hex string
            const hex = Array.from(value).map(b => b.toString(16).padStart(2, '0')).join(' ');
            // Add to buffer
            dataBuffer.current += hex + ' ';
            lastDataTime.current = Date.now();

            // Process buffer immediately if it gets too large
            if (dataBuffer.current.length > 10000) {
              processBuffer();
            }
          }
        } catch (error) {
          console.error('Error reading from WebSerial port:', error);
        } finally {
          reader.releaseLock();
          readerRef.current = null;
        }
      };

      readLoop();

      // Update serial status
      useAppStore.getState().setSerialStatus({
        connected: true,
        port: 'WebSerial',
        baudRate: USB_CDC_BAUD,
        error: null
      });
    } catch (error) {
      console.error('Error connecting to WebSerial port:', error);
      useAppStore.getState().setSerialStatus({
        connected: false,
        port: null,
        baudRate: null,
        error: error.message
      });
    }
  }, [processRawData]);

  const handleDisconnect = useCallback(async () => {
    // WebSerial disconnection
    if (webSerialPort) {
      try {
        // Stop the buffer processing timer
        if (bufferTimer.current) {
          clearInterval(bufferTimer.current);
          bufferTimer.current = null;
        }

        // Process any remaining data in the buffer
        if (dataBuffer.current.length > 0) {
          processRawData(dataBuffer.current.trim(), 'webserial');
          dataBuffer.current = '';
        }

        // Cancel any ongoing read operations
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (err) {
            console.warn('Error cancelling reader:', err);
          }
          readerRef.current = null;
        }

        // Close the port
        await webSerialPort.close();
      } catch (error) {
        console.error('Error closing WebSerial port:', error);
      } finally {
        setWebSerialPort(null);
        // Update serial status
        useAppStore.getState().setSerialStatus({
          connected: false,
          port: null,
          baudRate: null,
          error: null
        });
      }
    } else {
      // Even if webSerialPort is null, ensure status is updated
      useAppStore.getState().setSerialStatus({
        connected: false,
        port: null,
        baudRate: null,
        error: null
      });
    }
  }, [webSerialPort, processRawData]);

  const isConnected = serialStatus.connected;

  return (
    <>
      <span className={appStyles.separator} />

      {/* Connect / Disconnect */}
      {isConnected ? (
        <button className={styles.disconnectBtn} onClick={handleDisconnect}>
          Disconnect
        </button>
      ) : (
        <button
          className={styles.connectBtn}
          onClick={handleConnect}
        >
          Connect
        </button>
      )}

      {/* Status indicator */}
      <span className={isConnected ? styles.statusOn : styles.statusOff}>
        {isConnected
          ? '● Connected'
          : serialStatus.error
            ? `✕ ${serialStatus.error}`
            : '○ not connected'}
      </span>
    </>
  );
}
