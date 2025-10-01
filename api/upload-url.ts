// api/upload-url.ts
import { put } from '@vercel/blob';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: 'file required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Store in a folder; add random suffix for uniqueness
    const result = await put(
      `intake/${Date.now()}-${file.name}`,
      file,
      { access: 'public', contentType: file.type, addRandomSuffix: true }
    );

    return new Response(JSON.stringify({ url: result.url, pathname: result.pathname }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

