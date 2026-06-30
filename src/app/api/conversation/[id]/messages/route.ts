import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id, 10);
    if (!Number.isInteger(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { role, content, tokens } = body as { role?: string; content?: string; tokens?: number };

    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      return NextResponse.json({ error: 'role must be "user", "assistant", or "system"' }, { status: 400 });
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    if (!convo) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
        tokens: typeof tokens === 'number' ? tokens : null,
      })
      .returning();

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Failed to add message:', error);
    return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversationId = parseInt(id, 10);
    if (!Number.isInteger(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
    }

    const allMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return NextResponse.json({ messages: allMessages });
  } catch (error: any) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
