import { Context, SessionFlavor } from 'grammy';
import { Conversation, ConversationFlavor } from '@grammyjs/conversations';
import { SessionData } from './session';

type BaseContext = Context & SessionFlavor<SessionData>;
export type BotContext = ConversationFlavor<BaseContext>;
export type BotConversation = Conversation<BotContext>;
