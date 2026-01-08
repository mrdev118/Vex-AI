import type { IFCAU_API } from '@dongdev/fca-unofficial';
import { Threads } from '../../database/controllers/threadController';
import { Users } from '../../database/controllers/userController';
import { MessageEventType, MessageReplyEventType } from '../../types';
import { client } from '../client';
import { botConfig, isOwner } from '../config';
import { logger } from '../utils/logger';
import { createMessageHelper } from '../utils/message';
import { hasPermission } from '../utils/permissions';
import { checkCommandPermission } from '../utils/permissionsExtended';

const processingReplies = new Set<string>();

export const handleReplyEvent = async (
  api: IFCAU_API,
  event: MessageReplyEventType
): Promise<void> => {
  if (!event.messageReply || !event.messageReply.messageID) {
    logger.debug('HandleReply: messageReply hoặc messageID không tồn tại, bỏ qua');
    return;
  }

  const replyID = event.messageReply.messageID;

  if (processingReplies.has(replyID)) {
    logger.debug(`HandleReply: Đang xử lý replyID ${replyID}, bỏ qua`);
    return;
  }

  // Quick unsend helper: if user replies "unsend" to a bot message, remove that bot message
  const bodyText = ((event as any).body || "").trim().toLowerCase();
  const repliedSender = event.messageReply.senderID;
  if (bodyText === "unsend" && repliedSender === api.getCurrentUserID()) {
    if (!isOwner(event.senderID)) {
      const messageHelper = createMessageHelper(api, event as any);
      await messageHelper.send("❌ Only the bot owner can unsend my messages.");
      return;
    }
    processingReplies.add(replyID);
    try {
      await new Promise<void>((resolve, reject) => {
        api.unsendMessage(replyID, (err?: Error) => {
          if (err) return reject(err);
          resolve();
        });
      });
      const messageHelper = createMessageHelper(api, event as any);
      await messageHelper.send("🗑️ Removed my previous message as requested.");
    } catch (err) {
      const messageHelper = createMessageHelper(api, event as any);
      await messageHelper.send("⚠️ I couldn't unsend that message.");
      logger.error('Unsend reply handler error:', err);
    } finally {
      processingReplies.delete(replyID);
    }
    return;
  }

  if (client.handleReplies.has(replyID)) {
    const replyData = client.handleReplies.get(replyID);
    if (replyData) {
      const command = client.commands.get(replyData.name) || client.noprefix.get(replyData.name);
      if (!command) {
        client.handleReplies.delete(replyID);
        return;
      }

      if (!command.handleReply) {
        client.handleReplies.delete(replyID);
        return;
      }

      processingReplies.add(replyID);
      try {
        const fakeMessageEvent = {
          ...event,
          type: "message" as const,
          body: (event as any).body || "",
          threadID: event.threadID,
          senderID: event.senderID,
          messageID: event.messageID,
          isGroup: event.isGroup || false
        };

        const permCheck = await checkCommandPermission(api, command, fakeMessageEvent as MessageEventType, {
          adminOnly: botConfig.adminOnly,
          adminBox: botConfig.adminBox,
          antiINBOX: botConfig.antiINBOX
        });

        if (!permCheck.allowed) {
          const messageHelper = createMessageHelper(api, fakeMessageEvent as MessageEventType);
          await messageHelper.send(permCheck.reason || '❌ Bạn không có quyền sử dụng lệnh này!');
          return;
        }

        const requiredRole = command.config.role ?? 0;
        const hasAccess = await hasPermission(api, event.senderID, fakeMessageEvent as MessageEventType, requiredRole);

        if (!hasAccess) {
          const roleNames = ['Người dùng', 'Admin nhóm', 'Admin bot', 'Owner'];
          const messageHelper = createMessageHelper(api, fakeMessageEvent as any);
          await messageHelper.send(
            `❌ Bạn không có quyền sử dụng lệnh này!\n` +
            `Yêu cầu: ${roleNames[requiredRole]} (${requiredRole})`
          );
          return;
        }

        const messageHelper = createMessageHelper(api, fakeMessageEvent as any);
        await command.handleReply({
          api,
          event: fakeMessageEvent as any,
          args: [],
          name: replyData.name,
          config: command.config,
          Users,
          Threads,
          send: messageHelper.send,
          reply: messageHelper.reply,
          react: messageHelper.react,
          handleReply: replyData
        });
        logger.debug(`HandleReply: ${replyData.name} bởi ${event.senderID}`);
      } catch (error) {
        logger.error(`Lỗi HandleReply ${replyData.name}:`, error);
      } finally {
        processingReplies.delete(replyID);
      }
    }
  }
};
