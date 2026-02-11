import { InlineKeyboard } from 'grammy';

import { AiService } from 'src/modules/bot/ai/ai.service';

import { BotContext, BotConversation } from '../types/context';
import { FormConfig } from './form-configs';
import { FormFieldDef, parseCommaSeparated } from './comma-parser';
import { isCancel, replyCancelWithMenu, textWithCancel, waitForCallbackOrCancel } from './cancel';
import { buildConfirmationKeyboard, buildCancelKeyboard } from '../keyboards/confirmation.keyboard';
import { formatMoneyFull, escapeHtml, parseNumber } from './format';

export interface SingleMessageFlowResult {
  confirmed: boolean;
  data: Record<string, any>;
}

/**
 * Core single-message conversation flow.
 *
 * 1. Sends prompt with field list + example
 * 2. Waits for user input (text / voice / photo)
 * 3. Extracts via AI or comma parser
 * 4. Asks for missing required fields
 * 5. Shows confirmation
 * 6. Returns { confirmed, data } or null if cancelled
 */
export async function runSingleMessageFlow(
  conversation: BotConversation,
  ctx: BotContext,
  config: FormConfig,
  aiService: AiService,
  extra?: {
    projectName?: string;
    preSelectedData?: Record<string, any>;
    /** Override fields shown in prompt (e.g. when some fields are pre-selected) */
    promptFields?: FormFieldDef[];
  },
): Promise<SingleMessageFlowResult | null> {
  const projectName = extra?.projectName || '';
  const displayFields = extra?.promptFields ?? config.fields;

  // ── Step 1: Build and send prompt ──
  const fieldList = displayFields
    .map((f) => {
      const req = '\u{2022}';
      const enumHint =
        f.enumValues && f.enumLabels
          ? ` (${f.enumValues.map((v) => f.enumLabels![v] || v).join('/')})`
          : '';
      return `  ${req} ${f.label}${enumHint}`;
    })
    .join('\n');

  const prompt =
    `${config.emoji} <b>${config.title}</b>\n` +
    (projectName ? `\u{1F3D7}\u{FE0F} ${escapeHtml(projectName)}\n\n` : '\n') +
    `Quyidagi ma'lumotlarni <b>bir xabarda</b> yuboring:\n${fieldList}\n\n` +
    `${config.exampleMessage}\n\n` +
    `\u{1F4DD} Matn, \u{1F399}\u{FE0F} ovoz yoki \u{1F4F8} rasm yuboring.\n` +
    `<i>/cancel - bekor qilish</i>`;

  await ctx.reply(prompt, {
    parse_mode: 'HTML',
    reply_markup: buildCancelKeyboard(),
  });

  // ── Step 2: Wait for user input ──
  const inputCtx = await conversation.wait();

  if (isCancel(inputCtx)) {
    if (inputCtx.callbackQuery) {
      try { await inputCtx.answerCallbackQuery(); } catch {}
    }
    await replyCancelWithMenu(ctx);
    return null;
  }

  // ── Step 3: Extract data ──
  let extracted: Record<string, any> = {};

  console.log(`[singleMessageFlow] inputType: voice=${!!inputCtx.message?.voice}, photo=${!!inputCtx.message?.photo}, text=${!!inputCtx.message?.text}, aiAvailable=${aiService.isAvailable()}`);

  if (inputCtx.message?.voice && aiService.isAvailable()) {
    await ctx.reply('\u{1F399}\u{FE0F} Ovoz qayta ishlanmoqda...');
    try {
      const file = await inputCtx.getFile();
      console.log(`[singleMessageFlow] voice file_path: ${file.file_path}`);
      // Download + extract in one external() call to avoid Buffer serialization issues
      extracted = await conversation.external(async () => {
        const buffer = await aiService.downloadTelegramFile(file.file_path!);
        console.log(`[singleMessageFlow] downloaded voice: ${buffer.length} bytes`);
        return aiService.extractFromAudio(buffer, 'audio/ogg', config.formType as any);
      }) as Record<string, any>;
      console.log(`[singleMessageFlow] voice extraction result:`, JSON.stringify(extracted));
    } catch (err: any) {
      console.error(`[singleMessageFlow] voice extraction error:`, err?.message || err, err?.stack);
      await ctx.reply("Ovozni qayta ishlashda xatolik. Iltimos, matn yuboring.");
      const retryCtx = await conversation.wait();
      if (isCancel(retryCtx)) {
        await replyCancelWithMenu(ctx);
        return null;
      }
      if (retryCtx.message?.text) {
        extracted = await tryExtract(retryCtx.message.text, config, aiService, conversation);
      }
    }
  } else if (inputCtx.message?.photo && aiService.isAvailable()) {
    await ctx.reply('\u{1F4F8} Rasm qayta ishlanmoqda...');
    try {
      const photos = inputCtx.message.photo;
      const photo = photos[photos.length - 1];
      const file = await inputCtx.api.getFile(photo.file_id);
      console.log(`[singleMessageFlow] photo file_path: ${file.file_path}`);
      // Download + extract in one external() call to avoid Buffer serialization issues
      extracted = await conversation.external(async () => {
        const buffer = await aiService.downloadTelegramFile(file.file_path!);
        console.log(`[singleMessageFlow] downloaded photo: ${buffer.length} bytes`);
        return aiService.extractFromImage(buffer, 'image/jpeg', config.formType as any);
      }) as Record<string, any>;
      console.log(`[singleMessageFlow] photo extraction result:`, JSON.stringify(extracted));
    } catch (err: any) {
      console.error(`[singleMessageFlow] photo extraction error:`, err?.message || err, err?.stack);
      await ctx.reply("Rasmni qayta ishlashda xatolik. Iltimos, matn yuboring.");
      const retryCtx = await conversation.wait();
      if (isCancel(retryCtx)) {
        await replyCancelWithMenu(ctx);
        return null;
      }
      if (retryCtx.message?.text) {
        extracted = await tryExtract(retryCtx.message.text, config, aiService, conversation);
      }
    }
  } else if (inputCtx.message?.text) {
    extracted = await tryExtract(inputCtx.message.text, config, aiService, conversation);
  } else {
    if (inputCtx.message?.voice || inputCtx.message?.photo) {
      await ctx.reply("AI hozir mavjud emas. Iltimos, matn yuboring.");
      const retryCtx = await conversation.wait();
      if (isCancel(retryCtx)) {
        await replyCancelWithMenu(ctx);
        return null;
      }
      if (retryCtx.message?.text) {
        extracted = parseCommaSeparated(retryCtx.message.text, config.fields);
      }
    } else {
      await ctx.reply("Iltimos, matn, ovoz yoki rasm yuboring.");
      return null;
    }
  }

  // ── Step 4: Merge with pre-selected data ──
  if (extra?.preSelectedData) {
    extracted = { ...extracted, ...extra.preSelectedData };
  }

  // ── Step 5: Apply defaults ──
  for (const field of config.fields) {
    if (
      (extracted[field.key] === undefined || extracted[field.key] === null) &&
      field.default !== undefined
    ) {
      extracted[field.key] = field.default;
    }
  }

  // ── Step 6: Ask for missing required fields ──
  const missingRequired = config.fields.filter(
    (f) =>
      f.required &&
      (extracted[f.key] === undefined || extracted[f.key] === null || extracted[f.key] === ''),
  );

  for (const field of missingRequired) {
    if (field.type === 'enum' && field.enumValues) {
      const kb = new InlineKeyboard();
      for (const val of field.enumValues) {
        kb.text(field.enumLabels?.[val] || val, `fill:${val}`);
      }
      kb.row().text('\u{274C} Bekor qilish', 'conv:cancel');
      await ctx.reply(`${field.label}ni tanlang:`, { reply_markup: kb });
      const fillCtx = await waitForCallbackOrCancel(conversation, ctx, /^fill:/);
      extracted[field.key] = fillCtx.callbackQuery!.data!.split(':')[1];
      try { await fillCtx.answerCallbackQuery(); } catch {}
    } else {
      const hint = field.type === 'number' ? ' (raqam)' : '';
      await ctx.reply(`${field.label}ni kiriting${hint}:\n\n\u{1F4DD} Matn yoki \u{1F399}\u{FE0F} ovoz yuboring.`);
      const val = await waitForFieldValue(conversation, ctx, field, aiService);
      if (val === null) {
        await replyCancelWithMenu(ctx);
        return null;
      }
      extracted[field.key] = val;
    }
  }

  // ── Step 7+8: Confirmation loop (confirm / edit / cancel) ──
  const confirmPattern = new RegExp(`^${config.confirmPrefix}:(confirm|edit|cancel)`);
  const editableFields = config.fields.filter((f) => f.key !== 'items');

  for (;;) {
    // Build confirmation summary
    let summary = `${config.emoji} <b>${config.title}</b>\n\n`;
    if (projectName) summary += `\u{1F3D7}\u{FE0F} Obyekt: ${escapeHtml(projectName)}\n`;

    for (const field of editableFields) {
      const val = extracted[field.key];
      if (val === undefined || val === null) continue;

      if (field.type === 'number' && field.format !== 'plain') {
        summary += `${field.label}: <b>${formatMoneyFull(val)}</b>\n`;
      } else if (field.type === 'number' && field.format === 'plain') {
        summary += `${field.label}: <b>${val}</b>\n`;
      } else if (field.type === 'enum' && field.enumLabels) {
        summary += `${field.label}: ${field.enumLabels[val] || val}\n`;
      } else {
        summary += `${field.label}: ${escapeHtml(String(val))}\n`;
      }
    }

    summary += '\n\u{2705} Tasdiqlaysizmi?';

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: buildConfirmationKeyboard(config.confirmPrefix),
    });

    // Wait for confirm / edit / cancel
    const confirmCtx = await waitForCallbackOrCancel(conversation, ctx, confirmPattern, {
      otherwise: async (c) => {
        await c.reply('Iltimos, tasdiqlang, tahrirlang yoki bekor qiling.');
      },
    });
    try { await confirmCtx.answerCallbackQuery(); } catch {}

    const action = confirmCtx.callbackQuery!.data!.split(':').pop();

    if (action === 'cancel') {
      await replyCancelWithMenu(ctx);
      return { confirmed: false, data: extracted };
    }

    if (action === 'confirm') {
      return { confirmed: true, data: extracted };
    }

    // ── Edit flow ──
    const fieldsWithValues = editableFields.filter(
      (f) => extracted[f.key] !== undefined && extracted[f.key] !== null,
    );
    const allEditableFields = editableFields;
    const fieldsToShow = allEditableFields.length > 0 ? allEditableFields : fieldsWithValues;

    const editKb = new InlineKeyboard();
    for (const f of fieldsToShow) {
      const currentVal = extracted[f.key];
      let display = f.label;
      if (currentVal !== undefined && currentVal !== null) {
        if (f.type === 'number' && f.format !== 'plain') {
          display += `: ${formatMoneyFull(currentVal)}`;
        } else if (f.type === 'number' && f.format === 'plain') {
          display += `: ${currentVal}`;
        } else if (f.type === 'enum' && f.enumLabels) {
          display += `: ${f.enumLabels[currentVal] || currentVal}`;
        } else {
          display += `: ${String(currentVal).substring(0, 30)}`;
        }
      } else {
        display += ` (bo'sh)`;
      }
      editKb.text(display, `editf:${f.key}`).row();
    }
    editKb.text('\u{2B05}\u{FE0F} Ortga', `editf:back`);

    await ctx.reply('\u{270F}\u{FE0F} Qaysi maydonni tahrirlaysiz?', { reply_markup: editKb });

    const editFieldCtx = await waitForCallbackOrCancel(conversation, ctx, /^editf:/);
    try { await editFieldCtx.answerCallbackQuery(); } catch {}

    const selectedKey = editFieldCtx.callbackQuery!.data!.split(':')[1];
    if (selectedKey === 'back') continue; // back to confirmation

    const selectedField = editableFields.find((f) => f.key === selectedKey);
    if (!selectedField) continue;

    // Ask for new value
    if (selectedField.type === 'enum' && selectedField.enumValues) {
      const kb = new InlineKeyboard();
      for (const val of selectedField.enumValues) {
        kb.text(selectedField.enumLabels?.[val] || val, `fill:${val}`);
      }
      kb.row().text('\u{274C} Bekor qilish', 'conv:cancel');
      await ctx.reply(`${selectedField.label}ni tanlang:`, { reply_markup: kb });
      const fillCtx = await waitForCallbackOrCancel(conversation, ctx, /^fill:/);
      extracted[selectedField.key] = fillCtx.callbackQuery!.data!.split(':')[1];
      try { await fillCtx.answerCallbackQuery(); } catch {}
    } else {
      const hint = selectedField.type === 'number' ? ' (raqam)' : '';
      await ctx.reply(`${selectedField.label}ni kiriting${hint}:\n\n\u{1F4DD} Matn yoki \u{1F399}\u{FE0F} ovoz yuboring.`);
      const val = await waitForFieldValue(conversation, ctx, selectedField, aiService);
      if (val === null) {
        await replyCancelWithMenu(ctx);
        return { confirmed: false, data: extracted };
      }
      extracted[selectedField.key] = val;
    }
    // Loop back to show updated confirmation
  }
}

/**
 * Wait for a single field value — accepts text OR voice.
 * Returns the parsed value, or null if cancelled.
 */
async function waitForFieldValue(
  conversation: BotConversation,
  ctx: BotContext,
  field: FormFieldDef,
  aiService: AiService,
): Promise<any | null> {
  for (;;) {
    const inputCtx = await conversation.wait();

    if (isCancel(inputCtx)) {
      if (inputCtx.callbackQuery) {
        try { await inputCtx.answerCallbackQuery(); } catch {}
      }
      return null;
    }

    // Voice → transcribe via AI and extract the value
    if (inputCtx.message?.voice && aiService.isAvailable()) {
      await ctx.reply('\u{1F399}\u{FE0F} Ovoz qayta ishlanmoqda...');
      try {
        const file = await inputCtx.getFile();
        const prompt =
          `Extract a single value from this voice message.\n` +
          `Field: "${field.label}" (type: ${field.type})\n` +
          `Return ONLY a JSON object: {"value": <the extracted value>}\n` +
          `If it's a number, return a plain number. If text, return a string.\n` +
          `The message is in Uzbek or Russian.`;

        const result = await conversation.external(async () => {
          const buffer = await aiService.downloadTelegramFile(file.file_path!);
          const model = (aiService as any).model;
          const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
          const r = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { mimeType: 'audio/ogg', data: buf.toString('base64') } },
              ],
            }],
          });
          const text = r.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          return match ? JSON.parse(match[0]) : null;
        });

        if (result?.value !== undefined && result.value !== null) {
          if (field.type === 'number') {
            const num = typeof result.value === 'number' ? result.value : parseNumber(String(result.value));
            if (!isNaN(num) && num > 0) return num;
            await ctx.reply("Raqamni aniqlab bo'lmadi. Qayta urinib ko'ring:");
            continue;
          }
          return result.value;
        }
        await ctx.reply("Ovozdan ma'lumot olib bo'lmadi. Qayta urinib ko'ring:");
        continue;
      } catch (err: any) {
        console.error(`[waitForFieldValue] voice error:`, err?.message || err);
        await ctx.reply("Ovozni qayta ishlashda xatolik. Matn yoki ovoz yuboring:");
        continue;
      }
    }

    // Text input
    if (inputCtx.message?.text) {
      const text = inputCtx.message.text.trim();
      if (field.type === 'number') {
        const num = parseNumber(text);
        if (!isNaN(num) && num > 0) return num;
        await ctx.reply("Iltimos, to'g'ri raqam kiriting:");
        continue;
      }
      return text;
    }

    await ctx.reply("Iltimos, matn yoki ovoz yuboring:");
  }
}

/**
 * Try AI extraction first, fall back to comma parser.
 */
async function tryExtract(
  text: string,
  config: FormConfig,
  aiService: AiService,
  conversation: BotConversation,
): Promise<Record<string, any>> {
  console.log(`[tryExtract] formType=${config.formType}, aiAvailable=${aiService.isAvailable()}, text="${text.substring(0, 100)}"`);
  if (aiService.isAvailable()) {
    try {
      const result = await conversation.external(() =>
        aiService.extractFromText(text, config.formType as any),
      );
      console.log(`[tryExtract] AI result:`, JSON.stringify(result));
      if (result && Object.keys(result).length > 0) {
        return result as Record<string, any>;
      }
    } catch (err: any) {
      console.error(`[tryExtract] AI extraction failed:`, err?.message || err);
    }
  }
  console.log(`[tryExtract] Falling back to comma parser`);
  return parseCommaSeparated(text, config.fields);
}
