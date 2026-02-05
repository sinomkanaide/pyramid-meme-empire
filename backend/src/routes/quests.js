const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Quest = require('../models/Quest');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /quests - Get all quests with user status
router.get('/', async (req, res) => {
  try {
    console.log(`[Quests] Getting quests for user ${req.user.id}`);

    // First check if tables exist
    const tablesStatus = await Quest.tablesExist();
    console.log(`[Quests] Tables status:`, tablesStatus);

    if (!tablesStatus.quests || !tablesStatus.quest_completions) {
      console.log('[Quests] Tables missing, attempting to initialize...');
      try {
        await Quest.initializeTables();
        console.log('[Quests] Tables initialized successfully');
      } catch (initError) {
        console.error('[Quests] Failed to initialize tables:', initError);
        return res.status(500).json({
          error: 'Quest tables not initialized',
          details: initError.message,
          tablesStatus
        });
      }
    }

    const quests = await Quest.getAllWithUserStatus(req.user.id);
    const totalQuestXP = await Quest.getTotalQuestXP(req.user.id);

    console.log(`[Quests] Found ${quests.length} quests, total XP: ${totalQuestXP}`);

    res.json({
      quests,
      totalQuestXP,
      completedCount: quests.filter(q => q.isCompleted).length,
      totalCount: quests.length
    });
  } catch (error) {
    console.error('[Quests] Get quests error:', error);
    console.error('[Quests] Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to get quests',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorType: error.constructor.name
    });
  }
});

// GET /quests/progress/:questId - Get progress for a specific quest
router.get('/progress/:questId', async (req, res) => {
  try {
    const { questId } = req.params;

    const quest = await Quest.findByQuestId(questId);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const isCompleted = await Quest.isCompleted(req.user.id, questId);
    const canComplete = await Quest.canComplete(req.user.id, questId);

    res.json({
      questId,
      title: quest.title,
      isCompleted,
      ...canComplete
    });
  } catch (error) {
    console.error('Get quest progress error:', error);
    res.status(500).json({ error: 'Failed to get quest progress' });
  }
});

// POST /quests/complete - Complete a quest
router.post('/complete',
  body('questId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('[Quests] Validation errors:', errors.array());
      const errorMessages = errors.array().map(e => e.msg).join(', ');
      return res.status(400).json({ error: `Validation failed: ${errorMessages}`, errors: errors.array() });
    }

    const { questId } = req.body;
    console.log(`[Quests] Completing quest ${questId} for user ${req.user.id}`);

    try {
      // Check if quest exists and is active
      const quest = await Quest.findByQuestId(questId);
      if (!quest) {
        console.log(`[Quests] Quest not found: ${questId}`);
        return res.status(404).json({ error: 'Quest not found' });
      }

      console.log(`[Quests] Found quest: ${quest.title}, active: ${quest.is_active}, verification: ${quest.verification_method}`);

      if (!quest.is_active) {
        console.log(`[Quests] Quest inactive: ${questId}`);
        return res.status(400).json({ error: 'Quest is no longer active' });
      }

      // Check if already completed
      const isCompleted = await Quest.isCompleted(req.user.id, questId);
      if (isCompleted) {
        console.log(`[Quests] Quest already completed: ${questId}`);
        return res.status(400).json({
          error: 'Quest already completed',
          alreadyCompleted: true
        });
      }

      // For internal verification quests, check if user meets requirements
      if (quest.verification_method === 'internal') {
        const canComplete = await Quest.canComplete(req.user.id, questId);
        console.log(`[Quests] Internal quest requirements:`, canComplete);
        if (!canComplete.canComplete) {
          return res.status(400).json({
            error: 'Requirements not met',
            ...canComplete
          });
        }
      }

      // Complete the quest
      const completion = await Quest.complete(req.user.id, questId, quest.xp_reward);

      if (!completion) {
        return res.status(400).json({ error: 'Failed to complete quest' });
      }

      // Get updated totals
      const totalQuestXP = await Quest.getTotalQuestXP(req.user.id);

      res.json({
        success: true,
        questId,
        xpEarned: quest.xp_reward,
        totalQuestXP,
        message: `+${quest.xp_reward} XP earned!`
      });
    } catch (error) {
      console.error('Complete quest error:', error);
      res.status(500).json({ error: 'Failed to complete quest' });
    }
  }
);

// POST /quests/verify-external - For future API verification
router.post('/verify-external',
  body('questId').isString().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { questId } = req.body;

    try {
      const quest = await Quest.findByQuestId(questId);
      if (!quest) {
        return res.status(404).json({ error: 'Quest not found' });
      }

      // For now, just return success for manual verification
      // In the future, this will call Twitter API, KiiChain API, etc.
      if (quest.verification_method === 'manual') {
        // Manual verification - just mark as completed
        const isCompleted = await Quest.isCompleted(req.user.id, questId);
        if (isCompleted) {
          return res.json({
            verified: true,
            alreadyCompleted: true,
            message: 'Already verified'
          });
        }

        const completion = await Quest.complete(req.user.id, questId, quest.xp_reward);
        return res.json({
          verified: true,
          xpEarned: quest.xp_reward,
          message: `Verified! +${quest.xp_reward} XP`
        });
      }

      // Future: API verification
      res.json({
        verified: false,
        message: 'API verification not yet implemented'
      });
    } catch (error) {
      console.error('Verify external quest error:', error);
      res.status(500).json({ error: 'Failed to verify quest' });
    }
  }
);

module.exports = router;
