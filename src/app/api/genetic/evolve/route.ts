import { NextRequest, NextResponse } from 'next/server';
import { GeneticProgramming, type GeneticConfig } from '@/lib/genetic-programming';
import { db } from '@/db';
import { evolvedSolutions } from '@/db/schema';
import { desc } from 'drizzle-orm';

const MAX_GENERATIONS_CAP = 150;
const MAX_POPULATION_CAP = 200;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { problemType, problemDescription, targetFunction, config } = body as {
      problemType?: string;
      problemDescription?: string;
      targetFunction?: { testCases?: Array<{ input: Record<string, number>; output: number }> };
      config?: Partial<GeneticConfig>;
    };

    if (!problemType || typeof problemType !== 'string') {
      return NextResponse.json({ error: 'problemType is required' }, { status: 400 });
    }
    if (
      !targetFunction ||
      !Array.isArray(targetFunction.testCases) ||
      targetFunction.testCases.length === 0
    ) {
      return NextResponse.json(
        { error: 'targetFunction.testCases must be a non-empty array of { input, output }' },
        { status: 400 }
      );
    }
    for (const tc of targetFunction.testCases) {
      if (!tc || typeof tc.input !== 'object' || typeof tc.output !== 'number') {
        return NextResponse.json(
          { error: 'Each test case needs an "input" object and a numeric "output"' },
          { status: 400 }
        );
      }
    }

    // Cap generations/population server-side regardless of what the client
    // requests, to bound the (synchronous) compute time of this route.
    const safeConfig: Partial<GeneticConfig> = {
      ...config,
      maxGenerations: Math.min(config?.maxGenerations ?? 50, MAX_GENERATIONS_CAP),
      populationSize: Math.min(config?.populationSize ?? 50, MAX_POPULATION_CAP),
    };

    const fitnessFunction = (evaluate: (vars: Record<string, number>) => number): number => {
      let totalError = 0;
      let count = 0;

      for (const testCase of targetFunction.testCases!) {
        const result = evaluate(testCase.input);
        const expected = testCase.output;
        const error = Math.abs(result - expected);
        totalError += error;
        count++;
      }

      const avgError = totalError / count;
      return 1 / (1 + avgError);
    };

    const gp = new GeneticProgramming(safeConfig);
    const solutions: any[] = [];

    const best = await gp.evolve(fitnessFunction, (generation, individual) => {
      solutions.push({
        generation,
        fitness: individual.fitness,
        expression: gp.geneToString(individual.genome),
      });
    });

    const [saved] = await db
      .insert(evolvedSolutions)
      .values({
        problemType,
        problemDescription: problemDescription || '',
        generation: gp.getGeneration(),
        fitness: best.fitness,
        genome: best.genome,
        metadata: {
          expression: gp.geneToString(best.genome),
          config: safeConfig,
          evolutionHistory: solutions.slice(-10),
        },
      })
      .returning();

    return NextResponse.json({
      success: true,
      solution: {
        id: saved.id,
        expression: gp.geneToString(best.genome),
        fitness: best.fitness,
        generation: gp.getGeneration(),
        genome: best.genome,
      },
      history: solutions,
    });
  } catch (error: any) {
    console.error('Genetic evolution error:', error);
    return NextResponse.json({ error: 'Evolution failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 10;

    const solutions = await db
      .select()
      .from(evolvedSolutions)
      .orderBy(desc(evolvedSolutions.fitness)) // best fitness first (was ascending — bug)
      .limit(limit);

    return NextResponse.json({ solutions });
  } catch (error: any) {
    console.error('Failed to fetch solutions:', error);
    return NextResponse.json({ error: 'Failed to fetch solutions' }, { status: 500 });
  }
}
