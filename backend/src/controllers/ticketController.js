const prisma = require('../utils/db');
const { createNotification } = require('../services/notification');
const { logActivity } = require('../utils/activityLogger');
const { sendNewTicketNotificationEmail, sendTicketUpdateEmail } = require('../services/email');

const createTicket = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Title, description, and category are required.' });
    }

    const textLower = (title + ' ' + description).toLowerCase();
    const isLeaveKeyword = ['leave', 'wfh', 'work from home', 'sick leave', 'vacation', 'off day', 'absence'].some(k => textLower.includes(k));
    if (category === 'HR' || isLeaveKeyword) {
      return res.status(400).json({
        message: 'Leave and WFH requests must NOT be raised as tickets. Please submit a formal Leave Application Letter in the Attendance Portal.'
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        category,
        creatorId: req.user.id,
        status: 'OPEN'
      },
      include: {
        creator: { select: { id: true, name: true, employeeId: true, email: true } }
      }
    });

    // Notify admins that a ticket has been created
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
    for (let admin of admins) {
      await createNotification({
        userId: admin.id,
        title: 'New Ticket Raised',
        message: `${req.user.name} raised a ticket: "${title}" [Category: ${category}]`,
        type: 'TICKET_CREATED'
      });

      sendNewTicketNotificationEmail(admin, ticket, ticket.creator).catch((err) => {
        console.error('Failed to send ticket email to admin:', err);
      });
    }

    await logActivity({
      userId: req.user.id,
      action: 'TICKET_CREATE',
      details: `Raised ticket "${title}" under category ${category}`
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ message: 'Failed to create ticket.' });
  }
};

const getTickets = async (req, res) => {
  try {
    const { category, status } = req.query;
    const where = {};

    if (category) where.category = category;
    if (status) where.status = status;

    // RBAC Filter
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      where.creatorId = req.user.id;
    } else if (req.user.role === 'TEAM_LEADER') {
      // Leader sees their own raised tickets, and tickets from their team members
      const teamMembers = await prisma.teamMember.findMany({
        where: { team: { leaderId: req.user.id } }
      });
      const memberIds = teamMembers.map((m) => m.userId);
      where.OR = [
        { creatorId: req.user.id },
        { creatorId: { in: memberIds } },
        { assigneeId: req.user.id }
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, employeeId: true, email: true } },
        assignee: { select: { id: true, name: true, employeeId: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ message: 'Failed to fetch tickets.' });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigneeId } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found.' });
    }

    // Only Admin or Team Leader can modify ticket status/assignments
    if (req.user.role === 'INTERN' || req.user.role === 'EMPLOYEE') {
      return res.status(403).json({ message: 'Interns/Employees cannot change ticket status or assignees.' });
    }

    if (assigneeId) {
      const targetAssignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (targetAssignee && targetAssignee.role === 'ADMIN') {
        return res.status(400).json({ message: 'Tickets cannot be assigned to System Administrators.' });
      }
    }

    const data = {};
    if (status) data.status = status;
    if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data,
      include: { creator: true, assignee: true }
    });

    // Notify ticket creator
    let message = `Your ticket "${ticket.title}" has been updated.`;
    if (status) message = `Your ticket "${ticket.title}" status is now "${status}".`;
    if (assigneeId) message = `Your ticket "${ticket.title}" has been assigned to ${updatedTicket.assignee.name}.`;

    await createNotification({
      userId: ticket.creatorId,
      title: 'Ticket Updated',
      message,
      type: 'TICKET_UPDATED'
    });

    sendTicketUpdateEmail(updatedTicket.creator, updatedTicket, message).catch((err) => {
      console.error('Failed to send ticket update email:', err);
    });

    await logActivity({
      userId: req.user.id,
      action: 'TICKET_UPDATE',
      details: `Updated ticket "${ticket.title}". Status: ${status || ticket.status}. Assignee: ${assigneeId || 'Unassigned'}`
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Failed to update ticket.' });
  }
};

module.exports = {
  createTicket,
  getTickets,
  updateTicketStatus
};
