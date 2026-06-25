/**
 * Routes pour le chat / messages directs
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';
import { sendToN8nWebhook } from '../utils/n8n-webhook.js';

const router = Router();

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional()
});

/**
 * GET /api/chat/convos
 * Liste les conversations
 */
router.get('/convos', async (req: Request, res: Response) => {
  try {
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const session = bluesky.getSession();
    
    if (!session) {
      res.status(401).json({ success: false, error: 'No session' });
      return;
    }

    // Use the chat API with proper proxy header
    // The chat API requires using the DID's PDS as the service endpoint
    const result = await agent.api.chat.bsky.convo.listConvos(
      { limit: limit || 25, cursor },
      { 
        headers: { 
          'atproto-proxy': `did:web:api.bsky.chat#bsky_chat`
        } 
      }
    );

    // Envoyer chaque conversation individuellement au webhook n8n
    for (const convo of result.data.convos) {
      const enrichedConvo = {
        type: 'single_conversation',
        conversation: {
          id: convo.id,
          rev: convo.rev,
          members: convo.members?.map((m: any) => ({
            did: m.did,
            handle: m.handle,
            displayName: m.displayName,
            avatar: m.avatar,
            associated: m.associated,
            labels: m.labels,
            viewer: m.viewer
          })),
          lastMessage: convo.lastMessage ? {
            id: convo.lastMessage.id,
            text: convo.lastMessage.text,
            sender: convo.lastMessage.sender,
            sentAt: convo.lastMessage.sentAt
          } : null,
          muted: convo.muted,
          unreadCount: convo.unreadCount
        },
        currentUser: {
          did: session.did,
          handle: session.handle
        },
        fetchedAt: new Date().toISOString()
      };

      // Envoyer chaque conversation individuellement (fire-and-forget : ne pas
      // faire échouer la requête si n8n est indisponible)
      sendToN8nWebhook(enrichedConvo).catch((err) =>
        logger.warn('n8n webhook (convo) failed:', err?.message || err)
      );
    }

    res.json({
      success: true,
      data: {
        convos: result.data.convos,
        cursor: result.data.cursor
      }
    });
  } catch (error: any) {
    logger.error('List convos error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/chat/convos/:convoId
 * Obtient les messages d'une conversation
 */
router.get('/convos/:convoId', async (req: Request, res: Response) => {
  try {
    const { convoId } = req.params;
    const { limit, cursor } = paginationSchema.parse(req.query);
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    const session = bluesky.getSession();
    
    // Récupérer les messages
    const result = await agent.api.chat.bsky.convo.getMessages(
      { convoId, limit: limit || 50, cursor },
      { headers: { 'atproto-proxy': `did:web:api.bsky.chat#bsky_chat` } }
    );

    // Récupérer les informations de la conversation
    let convoDetails = null;
    try {
      const convoResult = await agent.api.chat.bsky.convo.getConvo(
        { convoId },
        { headers: { 'atproto-proxy': `did:web:api.bsky.chat#bsky_chat` } }
      );
      convoDetails = convoResult.data.convo;
    } catch (err) {
      logger.warn('Could not fetch convo details:', err);
    }

    // Envoyer chaque message individuellement au webhook n8n
    for (const msg of result.data.messages) {
      const enrichedMessage = {
        type: 'single_message',
        convoId,
        message: {
          id: msg.id,
          rev: msg.rev,
          text: msg.text,
          sender: {
            did: msg.sender?.did,
            handle: msg.sender?.handle,
            displayName: msg.sender?.displayName,
            avatar: msg.sender?.avatar,
            associated: msg.sender?.associated,
            labels: msg.sender?.labels,
            viewer: msg.sender?.viewer
          },
          sentAt: msg.sentAt,
          facets: msg.facets,
          embed: msg.embed
        },
        conversation: convoDetails ? {
          id: convoDetails.id,
          rev: convoDetails.rev,
          members: convoDetails.members?.map((m: any) => ({
            did: m.did,
            handle: m.handle,
            displayName: m.displayName,
            avatar: m.avatar,
            associated: m.associated,
            labels: m.labels
          })),
          muted: convoDetails.muted,
          unreadCount: convoDetails.unreadCount
        } : null,
        currentUser: session ? {
          did: session.did,
          handle: session.handle
        } : null,
        fetchedAt: new Date().toISOString()
      };

      // Envoyer chaque message individuellement (fire-and-forget)
      sendToN8nWebhook(enrichedMessage).catch((err) =>
        logger.warn('n8n webhook (message) failed:', err?.message || err)
      );
    }

    res.json({
      success: true,
      data: {
        messages: result.data.messages,
        cursor: result.data.cursor
      }
    });
  } catch (error: any) {
    logger.error('Get messages error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chat/convos/:convoId/messages
 * Envoie un message dans une conversation
 */
router.post('/convos/:convoId/messages', async (req: Request, res: Response) => {
  try {
    const { convoId } = req.params;
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: 'Text is required' });
      return;
    }

    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    const result = await agent.api.chat.bsky.convo.sendMessage(
      { convoId, message: { text } },
      { headers: { 'atproto-proxy': `did:web:api.bsky.chat#bsky_chat` } }
    );

    res.json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    logger.error('Send message error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to send message' });
  }
});

/**
 * POST /api/chat/convos
 * Crée ou obtient une conversation avec un utilisateur
 */
router.post('/convos', async (req: Request, res: Response) => {
  try {
    const { members } = req.body;
    
    if (!members || !Array.isArray(members) || members.length === 0) {
      res.status(400).json({ success: false, error: 'Members array is required' });
      return;
    }

    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    const result = await agent.api.chat.bsky.convo.getConvoForMembers(
      { members },
      { headers: { 'atproto-proxy': `did:web:api.bsky.chat#bsky_chat` } }
    );

    res.json({
      success: true,
      data: result.data.convo
    });
  } catch (error: any) {
    logger.error('Create convo error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to create conversation' });
  }
});

/**
 * POST /api/chat/convos/:convoId/read
 * Marque la conversation comme lue
 */
router.post('/convos/:convoId/read', async (req: Request, res: Response) => {
  try {
    const { convoId } = req.params;
    const bluesky = getBlueskyService();
    
    if (!bluesky.isLoggedIn()) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const agent = (bluesky as any).getAgent();
    
    await agent.api.chat.bsky.convo.updateRead(
      { convoId },
      { headers: { 'atproto-proxy': `did:web:api.bsky.chat#bsky_chat` } }
    );

    res.json({
      success: true,
      data: { message: 'Conversation marked as read' }
    });
  } catch (error: any) {
    logger.error('Mark read error:', error?.message || error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to mark as read' });
  }
});

export default router;
