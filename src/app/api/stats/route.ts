import { NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations, evolvedSolutions, constraintProblems } from '@/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Process start time, used to compute real uptime instead of faking it.
const PROCESS_START = Date.now();

export async function GET() {
  try {
    const [[convRow], [evoRow], [csRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(conversations),
      db.select({ count: sql<number>`count(*)::int` }).from(evolvedSolutions),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(constraintProblems)
        .where(sql`${constraintProblems.isSolved} = true`),
    ]);

    return NextResponse.json({
      totalConversations: convRow?.count ?? 0,
      evolvedSolutions: evoRow?.count ?? 0,
      solvedProblems: csRow?.count ?? 0,
      uptimeSeconds: Math.floor((Date.now() - PROCESS_START) / 1000),
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
