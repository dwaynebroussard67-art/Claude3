import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { conversations } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof (body as { title?: unknown }).title === 'string'
      ? (body as { title: string }).title.slice(0, 200)
      : 'New Conversation';

    const [conversation] = await db.insert(conversations).values({ title }).returning();

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(50);

    return NextResponse.json({ conversations: allConversations });
  } catch (error: any) {
    console.error('Failed to fetch conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}
