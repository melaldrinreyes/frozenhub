import { RequestHandler } from "express";
import { getConnection } from "../db";

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Get all conversations for a user (customer or branch admin)
export const handleGetConversations: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  console.log('=== GET CONVERSATIONS ===');
  console.log('User ID:', userId);
  console.log('User Role:', userRole);
  console.log('Branch ID:', req.user?.branch_id);

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    let query = "";
    let params: any[] = [];

    if (userRole === "customer") {
      // Get conversations where user is the customer
      query = `
        SELECT 
          c.id,
          c.customer_id,
          c.branch_id,
          c.last_message_at,
          c.customer_unread_count,
          c.branch_unread_count,
          c.created_at,
          b.name as branch_name,
          b.location as branch_location,
          u.name as customer_name,
          (
            SELECT message_text 
            FROM messages 
            WHERE conversation_id = c.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) as last_message
        FROM conversations c
        INNER JOIN branches b ON b.id = c.branch_id
        INNER JOIN users u ON u.id = c.customer_id
        WHERE c.customer_id = $1
          AND (c.deleted_for IS NULL OR NOT (c.deleted_for @> $2::jsonb))
        ORDER BY c.last_message_at DESC
      `;
      params = [userId, JSON.stringify([userId])];
    } else if (userRole === "branch_admin") {
      // Get conversations for the branch admin's branch (both customer and admin conversations)
      const branchId = req.user?.branch_id;
      console.log('Branch Admin Branch ID:', branchId);
      
      if (!branchId) {
        console.error('Branch admin has no branch_id assigned!');
        res.status(403).json({ error: "Branch admin must be assigned to a branch" });
        return;
      }

      query = `
        SELECT 
          c.id,
          c.customer_id,
          c.branch_id,
          c.last_message_at,
          c.customer_unread_count,
          c.branch_unread_count,
          c.created_at,
          b.name as branch_name,
          b.location as branch_location,
          CASE 
            WHEN c.customer_id IS NULL THEN 'Admin'
            ELSE u.name
          END as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          (
            SELECT message_text 
            FROM messages 
            WHERE conversation_id = c.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) as last_message
        FROM conversations c
        INNER JOIN branches b ON b.id = c.branch_id
        LEFT JOIN users u ON u.id = c.customer_id
        WHERE c.branch_id = $1
          AND (c.deleted_for IS NULL OR NOT (c.deleted_for @> $2::jsonb))
        ORDER BY c.last_message_at DESC
      `;
      params = [branchId, JSON.stringify([userId])];
      console.log('Branch admin query params:', params);
    } else if (userRole === "admin") {
      // Admin can see conversations where customer_id is NULL (admin-branch conversations)
      query = `
        SELECT 
          c.id,
          c.customer_id,
          c.branch_id,
          c.last_message_at,
          c.customer_unread_count,
          c.branch_unread_count,
          c.created_at,
          b.name as branch_name,
          b.location as branch_location,
          CASE 
            WHEN c.customer_id IS NULL THEN 'Admin'
            ELSE u.name
          END as customer_name,
          u.email as customer_email,
          u.phone as customer_phone,
          (
            SELECT message_text 
            FROM messages 
            WHERE conversation_id = c.id 
            ORDER BY created_at DESC 
            LIMIT 1
          ) as last_message
        FROM conversations c
        INNER JOIN branches b ON b.id = c.branch_id
        LEFT JOIN users u ON u.id = c.customer_id
        WHERE c.customer_id IS NULL
          AND (c.deleted_for IS NULL OR NOT (c.deleted_for @> $1::jsonb))
        ORDER BY c.last_message_at DESC
      `;
      params = [JSON.stringify([userId])];
    } else {
      res.status(403).json({ error: "Unauthorized role" });
      return;
    }

    console.log('Executing query with params:', params);
    const [rows] = await connection.query(query, params);
    console.log('Found conversations:', (rows as any[]).length);
    console.log('Conversations:', rows);
    
    res.json({ conversations: rows });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  } finally {
    connection?.release();
  }
};

// Get messages for a specific conversation
export const handleGetMessages: RequestHandler = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    // Verify user has access to this conversation
    const [convRows] = await connection.query(
      `SELECT customer_id, branch_id FROM conversations WHERE id = $1 LIMIT 1`,
      [conversationId]
    );

    const conversation = (convRows as any[])[0];
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Check access permissions
    if (userRole === "customer" && conversation.customer_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (userRole === "branch_admin") {
      const branchId = req.user?.branch_id;
      if (conversation.branch_id !== branchId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    // Get messages (exclude messages deleted by current user)
    const [rows] = await connection.query(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.sender_role,
        m.message_text,
        m.is_read,
        m.created_at,
        u.name as sender_name
      FROM messages m
      INNER JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
        AND (m.deleted_for IS NULL OR NOT (m.deleted_for @> $2::jsonb))
      ORDER BY m.created_at ASC`,
      [conversationId, JSON.stringify([userId])]
    );

    // Mark messages as read
    if (userRole === "customer") {
      await connection.query(
        `UPDATE messages 
         SET is_read = TRUE 
         WHERE conversation_id = $1 
           AND sender_role != 'customer' 
           AND is_read = FALSE`,
        [conversationId]
      );

      await connection.query(
        `UPDATE conversations 
         SET customer_unread_count = 0 
         WHERE id = $1`,
        [conversationId]
      );
    } else if (userRole === "branch_admin") {
      await connection.query(
        `UPDATE messages 
         SET is_read = TRUE 
         WHERE conversation_id = $1 
           AND sender_role != 'branch_admin' 
           AND is_read = FALSE`,
        [conversationId]
      );

      await connection.query(
        `UPDATE conversations 
         SET branch_unread_count = 0 
         WHERE id = $1`,
        [conversationId]
      );
    } else if (userRole === "admin") {
      await connection.query(
        `UPDATE messages 
         SET is_read = TRUE 
         WHERE conversation_id = $1 
           AND sender_role != 'admin' 
           AND is_read = FALSE`,
        [conversationId]
      );

      await connection.query(
        `UPDATE conversations 
         SET customer_unread_count = 0 
         WHERE id = $1`,
        [conversationId]
      );
    }

    res.json({ messages: rows });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  } finally {
    connection?.release();
  }
};

// Send a message
export const handleSendMessage: RequestHandler = async (req, res) => {
  const { conversationId, branchId, messageText } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!messageText || String(messageText).trim().length === 0) {
    res.status(400).json({ error: "Message text is required" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.beginTransaction();

    let finalConversationId = conversationId;

    // If no conversation exists, create one (for customers, admins, or branch admins)
    if (!finalConversationId && (userRole === "customer" || userRole === "admin" || userRole === "branch_admin")) {
      if (!branchId && userRole !== "branch_admin") {
        res.status(400).json({ error: "Branch ID is required for new conversations" });
        return;
      }

      // For branch_admin, use their own branch_id
      const targetBranchId = userRole === "branch_admin" ? req.user?.branch_id : branchId;

      if (!targetBranchId) {
        res.status(400).json({ error: "Branch ID is required" });
        return;
      }

      // Check if conversation already exists
      let existingConv;
      if (userRole === "customer") {
        [existingConv] = await connection.query(
          `SELECT id FROM conversations WHERE customer_id = $1 AND branch_id = $2 LIMIT 1`,
          [userId, targetBranchId]
        );
      } else if (userRole === "admin" || userRole === "branch_admin") {
        // For admin or branch_admin, customer_id should be NULL (admin-branch conversation)
        [existingConv] = await connection.query(
          `SELECT id FROM conversations WHERE customer_id IS NULL AND branch_id = $1 LIMIT 1`,
          [targetBranchId]
        );
      }

      if ((existingConv as any[]).length > 0) {
        finalConversationId = (existingConv as any[])[0].id;
      } else {
        // Create new conversation
        finalConversationId = randomId("conv");
        if (userRole === "customer") {
          await connection.query(
            `INSERT INTO conversations (id, customer_id, branch_id, last_message_at, customer_unread_count, branch_unread_count, created_at)
             VALUES ($1, $2, $3, NOW(), 0, 0, NOW())`,
            [finalConversationId, userId, targetBranchId]
          );
        } else if (userRole === "admin" || userRole === "branch_admin") {
          // For admin-branch conversations, customer_id is NULL
          await connection.query(
            `INSERT INTO conversations (id, customer_id, branch_id, last_message_at, customer_unread_count, branch_unread_count, created_at)
             VALUES ($1, NULL, $2, NOW(), 0, 0, NOW())`,
            [finalConversationId, targetBranchId]
          );
        }
      }
    }

    if (!finalConversationId) {
      res.status(400).json({ error: "Conversation ID is required" });
      return;
    }

    // Verify access to conversation
    const [convRows] = await connection.query(
      `SELECT customer_id, branch_id FROM conversations WHERE id = $1 LIMIT 1`,
      [finalConversationId]
    );

    const conversation = (convRows as any[])[0];
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Check permissions
    if (userRole === "customer" && conversation.customer_id !== userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (userRole === "branch_admin") {
      const userBranchId = req.user?.branch_id;
      if (conversation.branch_id !== userBranchId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    // Admin can send to any conversation
    // No additional check needed for admin

    // Create message
    const messageId = randomId("msg");
    await connection.query(
      `INSERT INTO messages (id, conversation_id, sender_id, sender_role, message_text, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
      [messageId, finalConversationId, userId, userRole, String(messageText).trim()]
    );

    // Update conversation
    if (userRole === "customer") {
      await connection.query(
        `UPDATE conversations 
         SET last_message_at = NOW(), 
             branch_unread_count = branch_unread_count + 1 
         WHERE id = $1`,
        [finalConversationId]
      );
    } else if (userRole === "branch_admin" || userRole === "admin") {
      // For branch_admin or admin sending to admin-branch conversation
      // If sender is branch_admin, increment customer_unread_count (which admin sees)
      // If sender is admin, increment branch_unread_count (which branch sees)
      if (userRole === "branch_admin") {
        await connection.query(
          `UPDATE conversations 
           SET last_message_at = NOW(), 
               customer_unread_count = customer_unread_count + 1 
           WHERE id = $1`,
          [finalConversationId]
        );
      } else {
        await connection.query(
          `UPDATE conversations 
           SET last_message_at = NOW(), 
               branch_unread_count = branch_unread_count + 1 
           WHERE id = $1`,
          [finalConversationId]
        );
      }
    }

    await connection.commit();

    // Get the created message with sender info
    const [msgRows] = await connection.query(
      `SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.sender_role,
        m.message_text,
        m.is_read,
        m.created_at,
        u.name as sender_name
      FROM messages m
      INNER JOIN users u ON u.id = m.sender_id
      WHERE m.id = $1
      LIMIT 1`,
      [messageId]
    );

    res.status(201).json({ message: (msgRows as any[])[0] });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  } finally {
    connection?.release();
  }
};

// Get unread message count
export const handleGetUnreadCount: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    let unreadCount = 0;

    if (userRole === "customer") {
      const [rows] = await connection.query(
        `SELECT COALESCE(SUM(customer_unread_count), 0)::INTEGER as unread_count
         FROM conversations
         WHERE customer_id = $1`,
        [userId]
      );
      unreadCount = (rows as any[])[0]?.unread_count || 0;
    } else if (userRole === "branch_admin") {
      const branchId = req.user?.branch_id;
      if (branchId) {
        const [rows] = await connection.query(
          `SELECT COALESCE(SUM(branch_unread_count), 0)::INTEGER as unread_count
           FROM conversations
           WHERE branch_id = $1`,
          [branchId]
        );
        unreadCount = (rows as any[])[0]?.unread_count || 0;
      }
    } else if (userRole === "admin") {
      const [rows] = await connection.query(
        `SELECT COALESCE(SUM(customer_unread_count), 0)::INTEGER as unread_count
         FROM conversations
         WHERE customer_id IS NULL`
      );
      unreadCount = (rows as any[])[0]?.unread_count || 0;
    }

    res.json({ unreadCount });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  } finally {
    connection?.release();
  }
};

// Debug endpoint to check user and conversations
export const handleDebugMessages: RequestHandler = async (req, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const branchId = req.user?.branch_id;

  let connection;
  try {
    connection = await getConnection();

    // Get all conversations
    const [allConvs] = await connection.query(
      `SELECT c.*, b.name as branch_name, u.name as customer_name
       FROM conversations c
       LEFT JOIN branches b ON b.id = c.branch_id
       LEFT JOIN users u ON u.id = c.customer_id
       ORDER BY c.created_at DESC`
    );

    // Get all messages
    const [allMsgs] = await connection.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       ORDER BY m.created_at DESC
       LIMIT 20`
    );

    res.json({
      currentUser: { userId, userRole, branchId },
      conversations: allConvs,
      recentMessages: allMsgs,
    });
  } catch (error) {
    console.error("Debug messages error:", error);
    res.status(500).json({ error: "Failed to fetch debug info" });
  } finally {
    connection?.release();
  }
};

// Delete a message (soft delete - only hides for the user who deleted it)
export const handleDeleteMessage: RequestHandler = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    // Get the message to verify access
    const [msgRows] = await connection.query(
      `SELECT m.*, c.customer_id, c.branch_id 
       FROM messages m
       INNER JOIN conversations c ON c.id = m.conversation_id
       WHERE m.id = $1
       LIMIT 1`,
      [messageId]
    );

    const message = (msgRows as any[])[0];
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    // Check if user has access to this conversation
    let hasAccess = false;
    if (userRole === "admin") {
      hasAccess = true;
    } else if (userRole === "customer" && message.customer_id === userId) {
      hasAccess = true;
    } else if (userRole === "branch_admin") {
      const branchId = req.user?.branch_id;
      if (message.branch_id === branchId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Soft delete: Add user ID to deleted_for array
    await connection.query(
      `UPDATE messages 
       SET deleted_for = CASE 
         WHEN deleted_for ? $2 THEN deleted_for 
         ELSE deleted_for || $2::jsonb 
       END
       WHERE id = $1`,
      [messageId, JSON.stringify(userId)]
    );

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ error: "Failed to delete message" });
  } finally {
    connection?.release();
  }
};

// Delete a conversation (soft delete - only hides for the user who deleted it)
export const handleDeleteConversation: RequestHandler = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let connection;
  try {
    connection = await getConnection();

    // Get the conversation to verify access
    const [convRows] = await connection.query(
      `SELECT customer_id, branch_id FROM conversations WHERE id = $1 LIMIT 1`,
      [conversationId]
    );

    const conversation = (convRows as any[])[0];
    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    // Check if user has access to this conversation
    let hasAccess = false;
    if (userRole === "admin") {
      hasAccess = true;
    } else if (userRole === "customer" && conversation.customer_id === userId) {
      hasAccess = true;
    } else if (userRole === "branch_admin") {
      const branchId = req.user?.branch_id;
      if (conversation.branch_id === branchId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Soft delete: Add user ID to deleted_for array
    await connection.query(
      `UPDATE conversations 
       SET deleted_for = CASE 
         WHEN deleted_for @> $2::jsonb THEN deleted_for 
         ELSE deleted_for || $2::jsonb 
       END
       WHERE id = $1`,
      [conversationId, JSON.stringify([userId])]
    );

    res.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  } finally {
    connection?.release();
  }
};
