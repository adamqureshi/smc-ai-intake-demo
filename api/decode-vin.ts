// api/decode-vin.ts
export const runtime = 'edge';

type VinInfo = {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  bodyClass?: string;
  vehicleType?: string;
};

export async function POST(req: Request) {
  try {
    const { vin } = await req.json();
    if (!vin || String(vin).replace(/\s/g, '').length < 11) {
      return new Response(JSON.stringify({ error: 'VIN is required' }), { status: 400 });
    }

    // NHTSA vPIC — decode single VIN
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(
      vin
    )}?format=json`;

    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return new Response(JSON.stringify({ error: 'decode failed' }), { status: 502 });

    const json = await r.json();
    const row = (json?.Results && json.Results[0]) || {};

    const info: VinInfo = {
      year: row.ModelYear || undefined,
      make: row.Make || undefined,
      model: row.Model || undefined,
      trim: row.Trim || undefined,
      bodyClass: row.BodyClass || undefined,
      vehicleType: row.VehicleType || undefined,
    };

    return Response.json({ ok: true, info });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'error' }), { status: 500 });
  }
}
