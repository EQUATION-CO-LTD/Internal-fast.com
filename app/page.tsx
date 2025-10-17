"use client";

import { useState, useEffect } from "react";

type TestStatus = "idle" | "testing" | "complete";

export default function Home() {
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [latency, setLatency] = useState<number>(0);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [currentTest, setCurrentTest] = useState<string>("");

  // Measure latency (ping)
  const measureLatency = async (): Promise<number> => {
    const measurements: number[] = [];

    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await fetch("/api/ping", { cache: "no-store" });
      const end = performance.now();
      measurements.push(end - start);
    }

    // Return average latency
    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  };

  // Measure download speed with multiple connections
  const measureDownload = async (
    onProgress: (speed: number) => void
  ): Promise<number> => {
    const testDuration = 8000; // 8 seconds test
    const numConnections = 6; // More parallel connections
    const chunkSize = 10; // 10MB per chunk

    let totalBytes = 0;
    let lastUpdate = 0;
    const startTime = performance.now();
    let isRunning = true;

    // Stop test after duration
    setTimeout(() => {
      isRunning = false;
    }, testDuration);

    const downloadChunk = async (): Promise<void> => {
      while (isRunning) {
        try {
          const response = await fetch(`/api/download?size=${chunkSize}`, {
            cache: "no-store",
          });

          if (!response.body) break;

          const reader = response.body.getReader();

          while (isRunning) {
            const { done, value } = await reader.read();
            if (done) break;

            totalBytes += value.length;

            // Update speed display every 200ms
            const now = performance.now();
            if (now - lastUpdate > 200) {
              const elapsed = (now - startTime) / 1000;
              if (elapsed > 0) {
                const currentSpeed = (totalBytes * 8) / (elapsed * 1000000);
                onProgress(currentSpeed);
                lastUpdate = now;
              }
            }
          }

          try {
            await reader.cancel();
          } catch (e) {
            // Ignore cancel errors
          }
        } catch (error) {
          console.error("Download chunk error:", error);
          break;
        }
      }
    };

    // Start multiple parallel downloads
    const downloads = Array(numConnections).fill(null).map(() => downloadChunk());
    await Promise.all(downloads);

    // Calculate final average speed
    const finalElapsed = (performance.now() - startTime) / 1000;
    const finalSpeed = finalElapsed > 0 ? (totalBytes * 8) / (finalElapsed * 1000000) : 0;

    console.log(`Download: ${totalBytes} bytes in ${finalElapsed}s = ${finalSpeed} Mbps`);

    return finalSpeed;
  };

  // Measure upload speed with multiple connections
  const measureUpload = async (
    onProgress: (speed: number) => void
  ): Promise<number> => {
    const testDuration = 8000; // 8 seconds test
    const numConnections = 4; // More parallel connections
    const chunkSize = 2 * 1024 * 1024; // 2MB per upload (smaller for faster iteration)

    let totalBytes = 0;
    const startTime = performance.now();
    let isRunning = true;

    // Stop test after duration
    setTimeout(() => {
      isRunning = false;
    }, testDuration);

    const uploadChunk = async (): Promise<void> => {
      while (isRunning) {
        const data = new Uint8Array(chunkSize);

        // Fill with random data in chunks (crypto.getRandomValues has a 65536 byte limit)
        const maxChunkSize = 65536;
        for (let i = 0; i < chunkSize; i += maxChunkSize) {
          const size = Math.min(maxChunkSize, chunkSize - i);
          const chunk = new Uint8Array(data.buffer, i, size);
          crypto.getRandomValues(chunk);
        }

        try {
          await fetch("/api/upload", {
            method: "POST",
            body: data,
            cache: "no-store",
          });

          totalBytes += chunkSize;

          // Calculate speed after each upload
          const elapsed = (performance.now() - startTime) / 1000;
          if (elapsed > 0) {
            const currentSpeed = (totalBytes * 8) / (elapsed * 1000000);
            onProgress(currentSpeed);
          }
        } catch (error) {
          console.error("Upload chunk error:", error);
          break;
        }

        if (!isRunning) break;
      }
    };

    // Start multiple parallel uploads
    const uploads = Array(numConnections).fill(null).map(() => uploadChunk());
    await Promise.all(uploads);

    // Calculate final average speed
    const finalElapsed = (performance.now() - startTime) / 1000;
    const finalSpeed = finalElapsed > 0 ? (totalBytes * 8) / (finalElapsed * 1000000) : 0;

    console.log(`Upload: ${totalBytes} bytes in ${finalElapsed}s = ${finalSpeed} Mbps`);

    return finalSpeed;
  };

  // Run all tests
  const runSpeedTest = async () => {
    setStatus("testing");
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setLatency(0);

    try {
      // Measure latency
      setCurrentTest("レイテンシを測定中...");
      const lat = await measureLatency();
      setLatency(lat);

      // Measure download speed
      setCurrentTest("ダウンロード速度を測定中...");
      const dlSpeed = await measureDownload((speed) => {
        setDownloadSpeed(speed);
      });
      setDownloadSpeed(dlSpeed);

      // Measure upload speed
      setCurrentTest("アップロード速度を測定中...");
      const upSpeed = await measureUpload((speed) => {
        setUploadSpeed(speed);
      });
      setUploadSpeed(upSpeed);

      setCurrentTest("測定完了");
      setStatus("complete");
    } catch (error) {
      console.error("Speed test failed:", error);
      setStatus("idle");
      setCurrentTest("測定エラーが発生しました");
    }
  };

  // Auto-start test on page load
  useEffect(() => {
    let cancelled = false;

    const initTest = async () => {
      if (!cancelled) {
        try {
          await runSpeedTest();
        } catch (error) {
          if (!cancelled) {
            console.error("Test initialization failed:", error);
          }
        }
      }
    };

    initTest();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '48rem',
        width: '100%'
      }}>
        {/* Main speed display */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            fontSize: 'clamp(4rem, 15vw, 8rem)',
            fontWeight: 'bold',
            letterSpacing: '-0.02em',
            lineHeight: '1'
          }}>
            {status === "testing" ? (
              <span style={{ color: '#ffffff' }}>
                {Math.round(downloadSpeed) || "—"}
              </span>
            ) : status === "complete" ? (
              <span style={{ color: '#ffffff' }}>{Math.round(downloadSpeed)}</span>
            ) : (
              <span style={{ color: '#4b5563' }}>—</span>
            )}
          </div>
          <div style={{
            fontSize: '1.5rem',
            color: '#9ca3af',
            marginTop: '0.5rem'
          }}>
            Mbps
          </div>
        </div>

        {/* Status message */}
        <div style={{
          fontSize: '1.125rem',
          color: '#9ca3af',
          minHeight: '2rem',
          marginBottom: '2rem'
        }}>
          {currentTest}
        </div>

        {/* Additional metrics */}
        {status === "complete" && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginTop: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: '#111827',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              textAlign: 'left'
            }}>
              <div style={{
                color: '#9ca3af',
                fontSize: '0.875rem',
                marginBottom: '0.5rem'
              }}>
                アップロード
              </div>
              <div style={{
                fontSize: '1.875rem',
                fontWeight: 'bold',
                color: '#ffffff'
              }}>
                {Math.round(uploadSpeed)} <span style={{ fontSize: '1.125rem' }}>Mbps</span>
              </div>
            </div>
            <div style={{
              background: '#111827',
              padding: '1.5rem',
              borderRadius: '0.5rem',
              textAlign: 'left'
            }}>
              <div style={{
                color: '#9ca3af',
                fontSize: '0.875rem',
                marginBottom: '0.5rem'
              }}>
                レイテンシ
              </div>
              <div style={{
                fontSize: '1.875rem',
                fontWeight: 'bold',
                color: '#ffffff'
              }}>
                {Math.round(latency)} <span style={{ fontSize: '1.125rem' }}>ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Retry button */}
        {status !== "testing" && (
          <button
            onClick={runSpeedTest}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 2rem',
              background: '#ffffff',
              color: '#000000',
              fontWeight: 'bold',
              borderRadius: '0.375rem',
              border: 'none',
              fontSize: '1.125rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            再測定
          </button>
        )}

        {/* Footer info */}
        <div style={{
          marginTop: '3rem',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          <p>通信速度測定ツール</p>
          <p style={{ marginTop: '0.5rem' }}>
            ダウンロード・アップロード速度とレイテンシを測定します
          </p>
          <p style={{
            marginTop: '1rem',
            fontSize: '0.75rem',
            color: '#9ca3af',
            fontStyle: 'italic'
          }}>
            ※ localhostでの測定はサーバー処理速度を測定しています。<br />
            実際のインターネット速度を測定するには本番環境へのデプロイが必要です。
          </p>
        </div>
      </div>
    </div>
  );
}
