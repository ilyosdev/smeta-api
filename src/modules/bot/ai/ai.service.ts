import { Injectable, Logger } from '@nestjs/common';
import {
  VertexAI,
  GenerativeModel,
} from '@google-cloud/vertexai';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { env } from 'src/common/config';

const execFileAsync = promisify(execFile);

export interface ExtractedIncome {
  amount?: number;
  source?: string;
  paymentType?: 'CASH' | 'TRANSFER';
  note?: string;
}

export interface ExtractedExpense {
  amount?: number;
  recipient?: string;
  category?: 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'TRANSPORT' | 'OTHER';
  paymentType?: 'CASH' | 'TRANSFER';
  note?: string;
}

export interface ExtractedWorkLog {
  workType?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
}

export type FormType =
  | 'income'
  | 'expense'
  | 'worklog'
  | 'cash_request'
  | 'cash_transaction'
  | 'warehouse_add'
  | 'supplier_debt'
  | 'worker_payment'
  | 'foreman_expense'
  | 'foreman_request'
  | 'supply_order';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private model: GenerativeModel | null = null;

  constructor() {
    const saPath = env.GOOGLE_SERVICE_ACCOUNT_PATH;
    const projectId = env.GCP_PROJECT_ID;
    const location = env.GCP_LOCATION || 'us-central1';

    if (saPath && projectId) {
      // Set GOOGLE_APPLICATION_CREDENTIALS for the SDK
      const absPath = path.isAbsolute(saPath)
        ? saPath
        : path.resolve(process.cwd(), saPath);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = absPath;

      const vertexAI = new VertexAI({ project: projectId, location });
      this.model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      this.logger.log(`AI service initialized with Vertex AI (project: ${projectId}, location: ${location})`);
    } else if (env.GEMINI_API_KEY) {
      // Fallback to old @google/generative-ai if only API key is provided
      // (keep backward compatibility but log warning)
      this.logger.warn('GEMINI_API_KEY is set but Vertex AI is preferred. Set GOOGLE_SERVICE_ACCOUNT_PATH + GCP_PROJECT_ID.');
    } else {
      this.logger.warn('No AI credentials configured, AI features disabled');
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  async extractFromText(
    text: string,
    formType: FormType,
  ): Promise<Record<string, any>> {
    if (!this.model) throw new Error('AI not configured');
    try {
      const prompt = this.getSystemPrompt(formType);
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt + '\n\n' + text }] }],
      });
      const response = result.response;
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.logger.log(`AI text extraction (${formType}): ${responseText.substring(0, 200)}`);
      return this.parseJsonResponse(responseText);
    } catch (error) {
      this.logger.error(`AI extractFromText (${formType}) failed:`, error?.message || error);
      throw error;
    }
  }

  async extractFromImage(
    imageBuffer: Buffer,
    mimeType: string,
    formType: FormType,
  ): Promise<Record<string, any>> {
    if (!this.model) throw new Error('AI not configured');
    try {
      const prompt = this.getSystemPrompt(formType);
      // Ensure it's a real Buffer (conversation.external() may deserialize to plain object)
      const buf = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer as any);
      this.logger.log(`AI image extraction (${formType}): ${buf.length} bytes, ${mimeType}`);
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: buf.toString('base64') } },
          ],
        }],
      });
      const response = result.response;
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.logger.log(`AI image result: ${responseText.substring(0, 200)}`);
      return this.parseJsonResponse(responseText);
    } catch (error) {
      this.logger.error(`AI extractFromImage (${formType}) failed:`, error?.message || error);
      throw error;
    }
  }

  async extractFromAudio(
    audioBuffer: Buffer,
    mimeType: string,
    formType: FormType,
  ): Promise<Record<string, any>> {
    if (!this.model) throw new Error('AI not configured');
    try {
      const prompt = this.getSystemPrompt(formType);
      // Ensure it's a real Buffer (conversation.external() may deserialize to plain object)
      const buf = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer as any);
      this.logger.log(`AI audio extraction (${formType}): ${buf.length} bytes, ${mimeType}`);
      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: buf.toString('base64') } },
          ],
        }],
      });
      const response = result.response;
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.logger.log(`AI audio result: ${responseText.substring(0, 200)}`);
      return this.parseJsonResponse(responseText);
    } catch (error) {
      this.logger.error(`AI extractFromAudio (${formType}) failed:`, error?.message || error);
      throw error;
    }
  }

  async downloadTelegramFile(filePath: string): Promise<Buffer> {
    const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Convert Telegram .oga voice file to .mp3 via ffmpeg.
   * Gemini supports audio/mp3 but not audio/ogg.
   */
  async convertOgaToMp3(ogaBuffer: Buffer): Promise<Buffer> {
    const tmpDir = os.tmpdir();
    const id = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const inputPath = path.join(tmpDir, `voice_${id}.oga`);
    const outputPath = path.join(tmpDir, `voice_${id}.mp3`);

    try {
      // Ensure it's a real Buffer (conversation.external() may deserialize to plain object)
      const buf = Buffer.isBuffer(ogaBuffer) ? ogaBuffer : Buffer.from(ogaBuffer as any);
      fs.writeFileSync(inputPath, buf);

      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-y',           // overwrite
        '-vn',          // no video
        '-ar', '16000', // 16kHz sample rate (good for speech)
        '-ac', '1',     // mono
        '-b:a', '64k',  // 64kbps bitrate
        outputPath,
      ]);

      const mp3Buffer = fs.readFileSync(outputPath);
      this.logger.log(`Converted OGA (${ogaBuffer.length} bytes) → MP3 (${mp3Buffer.length} bytes)`);
      return mp3Buffer;
    } finally {
      // Cleanup temp files
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    }
  }

  private getSystemPrompt(formType: FormType): string {
    const prompts: Record<FormType, string> = {
      income: `You are a data extraction assistant for a construction project management system.
Extract income/payment information from the user's message (text, voice transcription, or receipt image).
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - the monetary amount>,
  "source": "<string - who paid / source of income>",
  "paymentType": "<CASH or TRANSFER>",
  "note": "<string - any additional notes>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- "naqd" / "наличные" = CASH, "perechisleniye" / "o'tkazma" / "перевод" = TRANSFER
- If payment type is unclear, omit it
- Return ONLY valid JSON, no extra text`,

      expense: `You are a data extraction assistant for a construction project management system.
Extract expense/payment information from the user's message (text, voice transcription, or receipt image).
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - the monetary amount>,
  "recipient": "<string - who received the payment>",
  "category": "<MATERIAL | LABOR | EQUIPMENT | TRANSPORT | OTHER>",
  "paymentType": "<CASH or TRANSFER>",
  "note": "<string - any additional notes>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- Category mapping: cement/bricks/sand/wood/metal = MATERIAL, worker pay/salary = LABOR, crane/excavator/tools = EQUIPMENT, delivery/fuel/transport = TRANSPORT
- "naqd" / "наличные" = CASH, "perechisleniye" / "o'tkazma" / "перевод" = TRANSFER
- If a field is unclear, omit it
- Return ONLY valid JSON, no extra text`,

      worklog: `You are a data extraction assistant for a construction project management system.
Extract completed work information from the user's message (text, voice transcription, or photo).
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "workType": "<string - type of work, e.g. Suvoq, G'isht terish, Plitka>",
  "unit": "<string - unit of measurement, e.g. m², m³, dona, p.m.>",
  "quantity": <number - amount of work done>,
  "unitPrice": <number - price per unit, 0 if unknown>
}

Rules:
- Common work types: Suvoq (plastering), G'isht terish (bricklaying), Plitka (tiling), Beton quyish (concrete pouring), Armatura (rebar), Shpalaklyovka (putty), Boyoq (painting)
- Common units: m² (square meters), m³ (cubic meters), p.m. (linear meters), dona (pieces)
- If unit price is not mentioned, omit it
- Return ONLY valid JSON, no extra text`,

      cash_request: `You are a data extraction assistant for a construction project management system.
Extract cash request information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - the requested amount>,
  "reason": "<string - reason for the request>",
  "period": "<string - when the money is needed>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- Return ONLY valid JSON, no extra text`,

      cash_transaction: `You are a data extraction assistant for a construction project management system.
Extract cash transaction information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "type": "<IN or OUT - money coming in or going out>",
  "amount": <number - transaction amount>,
  "recipient": "<string - who is receiving/sending the money>",
  "reason": "<string - reason for the transaction>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- "kirim" / "приход" / "tushdi" = IN, "chiqim" / "расход" / "berish" / "berildi" = OUT
- Default to OUT if unclear
- Return ONLY valid JSON, no extra text`,

      warehouse_add: `You are a data extraction assistant for a construction project management system.
Extract warehouse item information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "name": "<string - product name>",
  "unit": "<string - unit of measurement: dona, kg, m, m², m³, litr, qop, tonna>",
  "quantity": <number - quantity>,
  "source": "<string - where the item came from (supplier name)>"
}

Rules:
- Common construction materials: sement, g'isht, qum, shag'al, armatura, sim, naycha, razetka, kabel
- Common units: dona (pieces), kg, tonna, m (meters), m² (sq meters), m³ (cubic meters), litr, qop (bags)
- Return ONLY valid JSON, no extra text`,

      supplier_debt: `You are a data extraction assistant for a construction project management system.
Extract supplier debt information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - debt amount>,
  "reason": "<string - reason for the debt>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- Return ONLY valid JSON, no extra text`,

      worker_payment: `You are a data extraction assistant for a construction project management system.
Extract worker payment information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - payment amount>,
  "note": "<string - any note about the payment>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- Return ONLY valid JSON, no extra text`,

      foreman_expense: `You are a data extraction assistant for a construction project management system.
Extract foreman expense information from the user's message.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with these fields (omit fields you cannot determine):
{
  "amount": <number - the monetary amount>,
  "paymentType": "<CASH or TRANSFER>",
  "note": "<string - reason or description>"
}

Rules:
- Amount should be a plain number without currency symbols
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- "naqd" / "наличные" = CASH, "perechisleniye" / "o'tkazma" / "перевод" = TRANSFER
- Default to CASH if unclear
- Return ONLY valid JSON, no extra text`,

      foreman_request: `You are a data extraction assistant for a construction project management system.
Extract material request information from the user's message. The message may contain ONE or MULTIPLE items.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with an "items" array:
{
  "items": [
    {
      "smetaItemName": "<string - smeta item / material name>",
      "requestedQty": <number - requested quantity>,
      "requestedUnit": "<string - unit: dona, kg, metr, m², m³, tonna, litr, qop>",
      "deadline": "<string - when needed (optional)>",
      "note": "<string - reason or notes (optional)>"
    }
  ]
}

Examples:
- "Sement 100 qop, armatura 500 kg" → 2 items
- "Rozetka 20 dona ertaga kerak" → 1 item with deadline "ertaga"
- "G'isht 5000 dona, sement 50 qop, qum 10 m³" → 3 items

Rules:
- ALWAYS return an "items" array, even for single item
- Common materials: Sement, Armatura, G'isht, Qum, Shag'al, Rozetka, Kabel, Gips karton, Suvoq, Bo'yoq
- Common units: dona (pieces), kg, tonna, metr, m², m³, litr, qop (bags)
- Return ONLY valid JSON, no extra text`,

      supply_order: `You are a data extraction assistant for a construction project management system.
Extract supply order items from the user's message. Each line represents one item.
The message is in Uzbek or Russian language.

Return ONLY a JSON object with this structure:
{
  "items": [
    { "name": "<product name>", "unit": "<unit>", "quantity": <number>, "unitPrice": <number> }
  ]
}

Rules:
- Each item should have: name, unit of measurement, quantity, unit price
- Common units: dona (pieces), kg, tonna, m, m², m³, litr, qop (bags)
- Prices should be plain numbers
- If amounts use shorthand like "5 mln" or "5М", convert to full number (5000000)
- Return ONLY valid JSON, no extra text`,
    };
    return prompts[formType];
  }

  private parseJsonResponse(text: string): any {
    try {
      // Try to extract JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        this.logger.warn(`No JSON found in AI response: ${text.substring(0, 200)}`);
        return {};
      }
      return JSON.parse(match[0]);
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${text.substring(0, 200)}`);
      return {};
    }
  }
}
