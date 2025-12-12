/**
 * Routes pour le chat / messages directs
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getBlueskyService } from '../services/bluesky.service.js';
import { logger } from '../utils/logger.js';

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
    
    // Use the chat API
    const result = await agent.api.chat.bsky.convo.listConvos({
      limit: limit || 25,
      cursor
    });

    res.json({
      success: true,
      data: {
        convos: result.data.convos,
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('List convos error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
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
    
    const result = await agent.api.chat.bsky.convo.getMessages({
      convoId,
      limit: limit || 50,
      cursor
    });

    res.json({
      success: true,
      data: {
        messages: result.data.messages,
        cursor: result.data.cursor
      }
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
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
    
    const result = await agent.api.chat.bsky.convo.sendMessage({
      convoId,
      message: {
        text
      }
    });

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
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
    
    const result = await agent.api.chat.bsky.convo.getConvoForMembers({
      members
    });

    res.json({
      success: true,
      data: result.data.convo
    });
  } catch (error) {
    logger.error('Create convo error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
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
    
    await agent.api.chat.bsky.convo.updateRead({
      convoId
    });

    res.json({
      success: true,
      data: { message: 'Conversation marked as read' }
    });
  } catch (error) {
    logger.error('Mark read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

export default router;
