import { InlineKeyboard } from 'grammy';

import { AiService } from 'src/modules/bot/ai/ai.service';

import { BotContext, BotConversation } from '../types/context';
import { isCancel, replyCancelWithMenu } from './cancel';
import { buildCancelKeyboard } from '../keyboards/confirmation.keyboard';

export interface SearchAndSelectOptions<T> {
  prompt: string;
  searchFn: (name: string) => Promise<T[]>;
  getLabel: (item: T) => string;
  getId: (item: T) => string;
  notFoundMessage: string;
  callbackPrefix: string;
  allowSkip?: boolean;
  aiService?: AiService;
}

/**
 * Reusable helper: text/voice → name → search → pick from results.
 *
 * Returns the selected entity, or null if cancelled/skipped.
 */
export async function searchAndSelectEntity<T>(
  conversation: BotConversation,
  ctx: BotContext,
  options: SearchAndSelectOptions<T>,
): Promise<T | null> {
  const { prompt, searchFn, getLabel, getId, notFoundMessage, callbackPrefix, allowSkip, aiService } = options;

  await ctx.reply(prompt + '\n\n<i>/cancel - bekor qilish</i>', {
    parse_mode: 'HTML',
    reply_markup: buildCancelKeyboard(),
  });

  for (;;) {
    const inputCtx = await conversation.wait();

    if (isCancel(inputCtx)) {
      if (inputCtx.callbackQuery) {
        try { await inputCtx.answerCallbackQuery(); } catch {}
      }
      await replyCancelWithMenu(ctx);
      return null;
    }

    let name = '';

    // Voice → extract text via AI
    if (inputCtx.message?.voice && aiService?.isAvailable()) {
      await ctx.reply('\u{1F399}\u{FE0F} Ovoz qayta ishlanmoqda...');
      try {
        const file = await inputCtx.getFile();
        const result = await conversation.external(async () => {
          const buffer = await aiService.downloadTelegramFile(file.file_path!);
          const model = (aiService as any).model;
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
          const r = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [
                { text: 'Extract the name/word from this voice message. Return ONLY a JSON object: {"name": "the name"}. The message is in Uzbek or Russian.' },
                { inlineData: { mimeType: 'audio/ogg', data: buf.toString('base64') } },
              ],
            }],
          });
          const text = r.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : null;
        });
        if (result?.name) {
          name = result.name.trim();
        }
      } catch {
        await ctx.reply("Ovozni qayta ishlashda xatolik. Matn yuboring:");
        continue;
      }
    } else if (inputCtx.message?.text) {
      name = inputCtx.message.text.trim();
    } else {
      await ctx.reply('Iltimos, matn yoki ovoz yuboring:');
      continue;
    }

    if (!name) {
      await ctx.reply('Iltimos, nomni kiriting:');
      continue;
    }

    // Search
    const results = await conversation.external(() => searchFn(name));

    if (results.length === 0) {
      await ctx.reply(`${notFoundMessage} Qayta kiriting:`);
      continue;
    }

    if (results.length === 1) {
      return results[0];
    }

    // Multiple results — show inline keyboard
    const kb = new InlineKeyboard();
    for (const item of results.slice(0, 10)) {
      kb.text(getLabel(item), `${callbackPrefix}:${getId(item)}`).row();
    }
    kb.text('\u{1F519} Qayta kiritish', `${callbackPrefix}:retry`);

    await ctx.reply('Qaysi birini tanlaysiz?', { reply_markup: kb });

    const pattern = new RegExp(`^${callbackPrefix}:`);
    for (;;) {
      const selCtx = await conversation.wait();

      if (isCancel(selCtx)) {
        if (selCtx.callbackQuery) {
          try { await selCtx.answerCallbackQuery(); } catch {}
        }
        await replyCancelWithMenu(ctx);
        return null;
      }

      if (selCtx.callbackQuery?.data && pattern.test(selCtx.callbackQuery.data)) {
        try { await selCtx.answerCallbackQuery(); } catch {}
        const selectedId = selCtx.callbackQuery.data.split(':')[1];

        if (selectedId === 'retry') {
          await ctx.reply(prompt);
          break; // break inner loop, continue outer loop
        }

        const found = results.find((item) => getId(item) === selectedId);
        if (found) return found;
      }

      // Ignore other messages while waiting for selection
    }
  }
}
