import type { IFCAU_API, IFCAU_ListenMessage } from '@dongdev/fca-unofficial';
import handleCreateData from '../../database/handleCreateData';
import { CommandEventType, MessageEventType, MessageReactionEventType, MessageReplyEventType, PresenceEventType, ReadReceiptEventType, ThreadEventType, TypingEventType } from '../../types';
import { hooks } from '../hooks';
import { messageLogger } from '../utils/messageLogger';
import { handleAnyEvent } from './anyEvent';
import { handleChat } from './chat';
import { handleCommand } from './command';
import { handleEvent, onEvent } from './event';
import { handleNicknameProtection, warmNicknameCache } from './nicknameProtection';
import { presence } from './presence';
import { handleReaction } from './reaction';
import { read_receipt } from './readReceipt';
import { handleReplyEvent } from './reply';
import { typ } from './typing';

const firstChatMap = new Map<string, boolean>();

export const handleEventMain = async (
  api: IFCAU_API,
  event: IFCAU_ListenMessage
): Promise<void> => {
  await hooks.executeOnAnyEvent(api, event);

  await handleAnyEvent(api, event);

  switch (event.type) {
    case "message":
    case "message_reply":
    case "message_unsend": {
      const isMessage = event.type === "message";
      const isMessageReply = event.type === "message_reply";

      if (isMessage) {
        const msgEvent = event as MessageEventType;
        const threadID = msgEvent.threadID;
        const isFirstChat = !firstChatMap.has(threadID);

        // Warm nickname cache early so we can restore nicknames if needed
        await warmNicknameCache(api, threadID);

        if (isFirstChat) {
          firstChatMap.set(threadID, true);
          await hooks.executeOnFirstChat(api, msgEvent);
        }
      }

      if (isMessage) {
        const msgEvent = event as MessageEventType;
        await handleCreateData(api, msgEvent);

        // Log the message to terminal
        await messageLogger.logMessage(api, msgEvent);

        await hooks.executeOnChat(api, msgEvent);
        await handleChat(api, msgEvent);
      }

      if (isMessage) {
        await hooks.executeOnRun(api, event as MessageEventType);
      }

      if (isMessage || isMessageReply) {
        await handleCommand(api, event as unknown as CommandEventType);
      }

      if (isMessageReply) {
        await hooks.executeOnReply(api, event as MessageReplyEventType);
        await handleReplyEvent(api, event as MessageReplyEventType);
      }
      break;
    }

    case "event": {
      const threadEvent = event as ThreadEventType;
      await warmNicknameCache(api, threadEvent.threadID);
      await handleNicknameProtection(api, threadEvent);
      await hooks.executeHandlerEvent(api, threadEvent);
      await handleEvent(api, threadEvent);
      await hooks.executeOnEvent(api, threadEvent);
      await onEvent(api, threadEvent);
      break;
    }

    case "message_reaction": {
      const reactionEvent = event as MessageReactionEventType;
      await hooks.executeOnReaction(api, reactionEvent);
      await handleReaction(api, reactionEvent);
      break;
    }

    case "typ": {
      const typingEvent = event as TypingEventType;
      await hooks.executeTyp(api, typingEvent);
      await typ(api, typingEvent);
      break;
    }

    case "presence": {
      const presenceEvent = event as PresenceEventType;
      await hooks.executePresence(api, presenceEvent);
      await presence(api, presenceEvent);
      break;
    }

    case "read_receipt": {
      const readReceiptEvent = event as ReadReceiptEventType;
      await hooks.executeReadReceipt(api, readReceiptEvent);
      await read_receipt(api, readReceiptEvent);
      break;
    }
  }
};

export { handleEventMain as handleEvent };

export { handleNoPrefixCommand } from './noprefix';
export { handlePrefixCommand } from './prefix';
export { handleReaction } from './reaction';
export { handleReplyEvent } from './reply';
