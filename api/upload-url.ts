// api/upload-url.ts
import { generateUploadURL } from '@vercel/blob';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { contentType, filename } = await req.json();
    if (!contentType || !filename) {
      return new Response(JSON.stringify({ error: 'contentType and filename required' }), { status: 400 });
    }
    const { url, id } = await generateUploadURL({
      contentType,
      metadata: { filename },
      access: 'public', // public file after upload
    });
    return Response.json({ url, id });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), { status: 500 });
  }
}
