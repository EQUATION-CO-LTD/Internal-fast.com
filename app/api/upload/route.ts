import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Quickly consume the request body without processing
    const reader = request.body?.getReader();

    if (!reader) {
      return NextResponse.json({ error: 'No data received' }, { status: 400 });
    }

    let totalBytes = 0;

    // Stream the data without storing it
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.length;
      // Don't process the data, just count bytes
    }

    // Return immediately
    return new NextResponse(
      JSON.stringify({
        success: true,
        bytesReceived: totalBytes,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
