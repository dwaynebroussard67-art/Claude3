import { NextRequest, NextResponse } from 'next/server';
import { ConstraintSolver, buildProblem, type CSProblemSpec } from '@/lib/constraint-solver';
import { db } from '@/db';
import { constraintProblems } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, description, problem } = body as {
      name?: string;
      description?: string;
      problem?: CSProblemSpec;
    };

    if (!problem || !Array.isArray(problem.variables) || !Array.isArray(problem.constraints)) {
      return NextResponse.json(
        { error: 'problem.variables and problem.constraints (arrays) are required' },
        { status: 400 }
      );
    }

    if (problem.variables.length === 0) {
      return NextResponse.json({ error: 'problem.variables must not be empty' }, { status: 400 });
    }

    for (const v of problem.variables) {
      if (!v || typeof v.name !== 'string' || !Array.isArray(v.domain) || v.domain.length === 0) {
        return NextResponse.json(
          { error: `Variable "${v?.name ?? '?'}" must have a name and a non-empty domain array` },
          { status: 400 }
        );
      }
    }

    let liveProblem;
    try {
      // Reconstructs real predicate functions from the serializable specs
      // sent by the client (constraint closures cannot travel over JSON).
      liveProblem = buildProblem(problem);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Invalid constraint spec: ${e.message || e}` },
        { status: 400 }
      );
    }

    const solver = new ConstraintSolver(liveProblem);
    const startTime = Date.now();
    const solution = solver.solve();
    const solvingTime = Date.now() - startTime;

    const [saved] = await db
      .insert(constraintProblems)
      .values({
        name: name || 'Untitled problem',
        description: description || '',
        variables: problem.variables,
        // Store the serializable spec (not the live predicate-bearing
        // constraint objects, which can't be persisted as JSON either).
        constraints: problem.constraints,
        solution: solution?.assignment || null,
        solutionMethod: 'backtracking',
        solvingTime,
        isSolved: solution !== null,
        solvedAt: solution ? new Date() : null,
      })
      .returning();

    return NextResponse.json({
      success: solution !== null,
      solution: solution?.assignment || null,
      backtrackCount: solution?.backtrackCount || 0,
      timeMs: solvingTime,
      problemId: saved.id,
    });
  } catch (error: any) {
    console.error('Constraint solving error:', error);
    return NextResponse.json({ error: 'Solving failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 10;

    const problems = await db
      .select()
      .from(constraintProblems)
      .orderBy(desc(constraintProblems.createdAt))
      .limit(limit);

    return NextResponse.json({ problems });
  } catch (error: any) {
    console.error('Failed to fetch problems:', error);
    return NextResponse.json({ error: 'Failed to fetch problems' }, { status: 500 });
  }
}
