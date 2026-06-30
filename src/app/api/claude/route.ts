import { NextRequest, NextResponse } from 'next/server';
import { adaptiveSystem } from '@/lib/self-adaptive';

// Uses Hugging Face's Inference Providers (free monthly credits, no
// credit card required) instead of a paid API. Get a free token at
// https://huggingface.co/settings/tokens (a "Read" token is enough) and
// set it as HF_TOKEN in your environment / Vercel project settings.
//
// Uses the OpenAI-compatible chat completions endpoint, which lets us
// route to any supported open model without a separate SDK.
const HF_MODEL = process.env.HF_MODEL || 'deepseek-ai/DeepSeek-V3-0324';
const HF_URL = 'https://router.huggingface.co/v1/chat/completions';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.HF_TOKEN) {
      return NextResponse.json(
        { error: 'HF_TOKEN not configured. Get a free token at huggingface.co/settings/tokens and add it to your environment variables.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { messages, system, temperature = 0.7, maxTokens = 4096 } = body as {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      system?: string;
      temperature?: number;
      maxTokens?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 });
    }
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return NextResponse.json(
          { error: 'Each message must have role "user"|"assistant" and string content' },
          { status: 400 }
        );
      }
    }
    if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
      return NextResponse.json({ error: 'temperature must be a number between 0 and 2' }, { status: 400 });
    }
    const cappedMaxTokens = Math.min(Math.max(Number(maxTokens) || 0, 1), 8192);

    // OpenAI-style chat format: system message first (if provided), then
    // the user/assistant turns as-is.
    const chatMessages = [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ];

    const startedAt = Date.now();
    const res = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: chatMessages,
        temperature,
        max_tokens: cappedMaxTokens,
      }),
    });

    const data = await res.json();
    adaptiveSystem.addMetric({
      name: 'hf_response_time_ms',
      value: Date.now() - startedAt,
      timestamp: Date.now(),
    });

    if (!res.ok) {
      console.error('Hugging Face API error:', data);
      return NextResponse.json(
        { error: data?.error?.message || data?.error || 'Failed to communicate with Hugging Face' },
        { status: res.status }
      );
    }

    const choice = data?.choices?.[0];
    const text: string = choice?.message?.content || '';

    return NextResponse.json({
      content: text,
      usage: {
        input_tokens: data?.usage?.prompt_tokens ?? 0,
        output_tokens: data?.usage?.completion_tokens ?? 0,
      },
      role: 'assistant',
      model: data?.model || HF_MODEL,
      finishReason: choice?.finish_reason,
    });
  } catch (error: any) {
    console.error('Hugging Face API error:', error);
    return NextResponse.json(
      { error: 'Failed to communicate with Hugging Face. Please try again.' },
      { status: 500 }
    );
  }
}
