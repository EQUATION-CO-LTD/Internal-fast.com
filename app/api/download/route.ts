import { NextRequest, NextResponse } from 'next/server';

// Pre-generate a large buffer of random data for reuse
const BUFFER_SIZE = 1024 * 1024; // 1MB
const preGeneratedBuffer = new Uint8Array(BUFFER_SIZE);
for (let i = 0; i < BUFFER_SIZE; i++) {
  preGeneratedBuffer[i] = Math.floor(Math.random() * 256);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const size = parseInt(searchParams.get('size') || '10', 10); // Default 10MB

  const dataSize = size * 1024 * 1024;
  const chunkSize = 256 * 1024; // 256KB chunks for faster streaming

  const stream = new ReadableStream({
    async start(controller) {
      let sent = 0;

      while (sent < dataSize) {
        const remaining = dataSize - sent;
        const currentChunkSize = Math.min(chunkSize, remaining);

        // Reuse pre-generated buffer instead of creating new random data
        const chunk = preGeneratedBuffer.slice(0, currentChunkSize);

        controller.enqueue(chunk);
        sent += currentChunkSize;

        // Yield control to allow asynchronous processing
        if (sent % (chunkSize * 4) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': dataSize.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
