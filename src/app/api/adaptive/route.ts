import { NextRequest, NextResponse } from 'next/server';
import { adaptiveSystem } from '@/lib/self-adaptive';

// Exposes the (previously unused) SelfAdaptiveSystem singleton so the
// dashboard can show real parameter/metric state instead of nothing.
// Note: in serverless deployments this in-memory singleton resets per
// instance/cold start, same caveat as the genetic population store in the
// sibling chat-architecture project — fine for a single dev server, not a
// durable store across instances.
export async function GET() {
  try {
    const state = adaptiveSystem.getState();
    return NextResponse.json(state);
  } catch (error) {
    console.error('Failed to fetch adaptive state:', error);
    return NextResponse.json({ error: 'Failed to fetch adaptive state' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { metricName, value } = (body || {}) as { metricName?: string; value?: number };
    if (typeof metricName !== 'string' || typeof value !== 'number') {
      return NextResponse.json({ error: 'metricName (string) and value (number) are required' }, { status: 400 });
    }
    adaptiveSystem.addMetric({ name: metricName, value, timestamp: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to record metric:', error);
    return NextResponse.json({ error: 'Failed to record metric' }, { status: 500 });
  }
}
