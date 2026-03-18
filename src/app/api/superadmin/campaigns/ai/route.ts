import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { UserModel, connectDb } from '@/lib/auth/db';
import { getCurrentSessionUserId } from '@/lib/auth/session';

async function ensureSuperAdmin(userId: string) {
  const user = await UserModel.findOne({ id: userId }).lean();
  if (!user) return { ok: false, status: 404, error: 'User not found', code: 'USER_NOT_FOUND' } as const;
  if (user.role !== 'superAdmin') {
    return { ok: false, status: 403, error: 'Forbidden', code: 'FORBIDDEN' } as const;
  }
  return { ok: true, user } as const;
}

const jsonFromText = (content: string) => {
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(content.slice(first, last + 1));
  } catch {
    return null;
  }
};

export async function POST(request: Request) {
  try {
    await connectDb();
    const currentUserId = await getCurrentSessionUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

    const auth = await ensureSuperAdmin(currentUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY', code: 'OPENAI_KEY_MISSING' }, { status: 400 });
    }

    const payload = await request.json();
    const goal = String(payload.goal || '').trim();
    const tone = String(payload.tone || 'professionnel').trim();
    const language = String(payload.language || 'fr').trim();
    const audience = String(payload.audience || 'all').trim();

    if (!goal) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: 'gpt-5-nano',
      input: [
        {
          role: 'system',
          content:
            'You write concise, professional marketing emails. Output strict JSON with keys subject, html, text. Use placeholders {name}, {companyName} where relevant.',
        },
        {
          role: 'user',
          content: `Language: ${language}. Audience: ${audience}. Tone: ${tone}. Goal: ${goal}. Provide HTML and text.`,
        },
      ],
    });

    const content = response.output_text || '';
    const parsed = jsonFromText(content);
    if (!parsed?.subject || !parsed?.html) {
      return NextResponse.json({ error: 'AI response invalid', code: 'AI_RESPONSE_INVALID' }, { status: 500 });
    }

    return NextResponse.json({
      subject: String(parsed.subject),
      html: String(parsed.html),
      text: String(parsed.text || ''),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content', code: 'AI_GENERATION_FAILED' },
      { status: 500 }
    );
  }
}
