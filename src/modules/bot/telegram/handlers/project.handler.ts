import { Injectable, Logger } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';

import { VendorProjectsService } from 'src/modules/vendor/projects/vendor-projects.service';

import { BotContext } from '../types/context';
import { isAuthenticated, sessionToUser } from '../helpers/session-to-user';

@Injectable()
export class ProjectHandler {
  private readonly logger = new Logger(ProjectHandler.name);

  constructor(private readonly projectsService: VendorProjectsService) {}

  async showProjectList(ctx: BotContext): Promise<void> {
    if (!isAuthenticated(ctx.session)) {
      await ctx.reply('Avval tizimga kiring: /start');
      return;
    }

    try {
      const user = sessionToUser(ctx.session, ctx.from!.id);
      const result = await this.projectsService.findAll(
        { page: 1, limit: 50 },
        user,
      );

      if (result.data.length === 0) {
        await ctx.reply('Sizga biriktirilgan loyihalar topilmadi.');
        return;
      }

      const keyboard = new InlineKeyboard();
      for (const project of result.data) {
        keyboard.text(
          `🏗️ ${project.name}`,
          `project:${project.id}`,
        ).row();
      }

      const text = '📋 Loyihani tanlang:';

      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { reply_markup: keyboard });
      } else {
        await ctx.reply(text, { reply_markup: keyboard });
      }
    } catch (error) {
      this.logger.error('Error fetching projects', error);
      await ctx.reply('Loyihalarni yuklashda xatolik yuz berdi.');
    }
  }

  async handleProjectSelect(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery?.data) return;

    const projectId = ctx.callbackQuery.data.replace('project:', '');

    try {
      if (!isAuthenticated(ctx.session)) {
        try { await ctx.answerCallbackQuery({ text: 'Avval tizimga kiring: /start' }); } catch {}
        return;
      }

      const user = sessionToUser(ctx.session, ctx.from!.id);
      const project = await this.projectsService.findOne(projectId, user);

      ctx.session.selectedProjectId = project.id;
      ctx.session.selectedProjectName = project.name;

      try { await ctx.answerCallbackQuery(); } catch { /* stale query */ }
    } catch (error) {
      this.logger.error('Error selecting project', error);
      try { await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi' }); } catch { /* stale query */ }
    }
  }
}
