import { NextRequest, NextResponse } from 'next/server';
import { NeuroSymbolicEngine } from '@/lib/neuro-symbolic';
import { db } from '@/db';
import { knowledgeBase } from '@/db/schema';
import { desc } from 'drizzle-orm';

// Wires up the previously-unused NeuroSymbolicEngine: takes user-provided
// facts, runs the engine's built-in rules (transitivity, AND/OR, etc.) via
// forward chaining, persists newly-derived facts to knowledge_base, and
// returns the inference trace.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { facts } = (body || {}) as {
      facts?: Array<{ key: string; value: unknown; confidence?: number }>;
    };

    if (!Array.isArray(facts) || facts.length === 0) {
      return NextResponse.json({ error: 'facts must be a non-empty array of { key, value }' }, { status: 400 });
    }
    for (const f of facts) {
      if (!f || typeof f.key !== 'string') {
        return NextResponse.json({ error: 'Each fact needs a string "key"' }, { status: 400 });
      }
    }

    const engine = new NeuroSymbolicEngine();
    for (const f of facts) {
      engine.addFact(f.key, f.value, typeof f.confidence === 'number' ? f.confidence : 1.0, 'user');
    }

    const result = engine.forwardChain();

    // Persist newly-derived (non-user-sourced) facts as knowledge base entries.
    const derived = result.facts.filter((f) => f.source !== 'user');
    if (derived.length > 0) {
      await db.insert(knowledgeBase).values(
        derived.map((f) => ({
          concept: f.key,
          category: 'fact' as const,
          symbolicRepresentation: { value: f.value, derivedFrom: f.derivedFrom ?? [] },
          confidence: f.confidence,
          source: 'neuro-symbolic-engine',
          lastUsed: new Date(),
        }))
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Neuro-symbolic inference error:', error);
    return NextResponse.json({ error: 'Inference failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

    const entries = await db
      .select()
      .from(knowledgeBase)
      .orderBy(desc(knowledgeBase.createdAt))
      .limit(limit);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Failed to fetch knowledge base:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 });
  }
}
