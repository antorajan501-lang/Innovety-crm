const nodemailer = require('nodemailer');

let transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    // Production / Configured SMTP
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
  } else {
    // Ethereal Dev SMTP fallback
    console.log('No SMTP credentials in .env. Creating Ethereal Test Account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`Ethereal credentials generated. User: ${testAccount.user}`);
    } catch (err) {
      console.error('Failed to create Ethereal SMTP transporter, using console logger fallback:', err);
      // Fallback logger
      transporter = {
        sendMail: async (options) => {
          console.log('\n--- EMAIL LOGGER FALLBACK ---');
          console.log(`TO: ${options.to}`);
          console.log(`SUBJECT: ${options.subject}`);
          console.log(`TEXT: ${options.text}`);
          console.log('-----------------------------\n');
          return { messageId: 'console-log-id' };
        }
      };
    }
  }

  return transporter;
};

const sendWelcomeEmail = async (user, temporaryPassword) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const mailOptions = {
    from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
    to: user.email,
    subject: `Welcome to ${companyName} - Internship CRM Credentials`,
    text: `Hello ${user.name},\n\n` +
          `Welcome to ${companyName}! Your intern account has been successfully created.\n\n` +
          `Here are your login credentials to access the CRM portal:\n` +
          `- Portal URL: ${loginUrl}\n` +
          `- Username (Email): ${user.email}\n` +
          `- Employee ID: ${user.employeeId}\n` +
          `- Temporary Password: ${temporaryPassword}\n\n` +
          `Important: Please log in using the temporary password (which is your Date of Birth formatted as DDMMYYYY with slashes removed) and immediately navigate to your Profile to set a new secure password.\n\n` +
          `Best regards,\n` +
          `HR Team, ${companyName}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
          `<h2 style="color: #4f46e5; margin-bottom: 20px;">Welcome to ${companyName}!</h2>` +
          `<p>Hello <strong>${user.name}</strong>,</p>` +
          `<p>Your internship account has been successfully created. You can now access our Internship CRM portal to log attendance, manage your tasks, and collaborate with your team.</p>` +
          `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
          `  <p style="margin: 5px 0;"><strong>Portal URL:</strong> <a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a></p>` +
          `  <p style="margin: 5px 0;"><strong>Username:</strong> ${user.email}</p>` +
          `  <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${user.employeeId}</p>` +
          `  <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${temporaryPassword}</code></p>` +
          `</div>` +
          `<p style="color: #e11d48; font-weight: 500;">Please change your password immediately after your first login.</p>` +
          `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">Best regards,<br/>HR & Operations, ${companyName}</p>` +
          `</div>`
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Welcome email successfully sent to ${user.email} (Message ID: ${info.messageId})`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal Email Preview URL: ${previewUrl}`);
    }
    return info;
  } catch (error) {
    console.error(`Failed to send welcome email to ${user.email}:`, error);
    throw error;
  }
};

const sendTaskAssignmentEmail = async (assignee, task, creator) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const taskBoardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tasks`;

  const mailOptions = {
    from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
    to: assignee.email,
    subject: `New Task Assigned: ${task.title}`,
    text: `Hello ${assignee.name},\n\n` +
          `You have been assigned a new task: "${task.title}".\n` +
          `- Priority: ${task.priority}\n` +
          `- Deadline: ${new Date(task.deadline).toLocaleDateString()}\n` +
          `- Assigned By: ${creator.name}\n\n` +
          `Please check your Task Board for details: ${taskBoardUrl}\n\n` +
          `Best regards,\n` +
          `Operations Team, ${companyName}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
          `<h2 style="color: #4f46e5; margin-bottom: 20px;">New Task Assigned</h2>` +
          `<p>Hello <strong>${assignee.name}</strong>,</p>` +
          `<p>You have been assigned a new task on the CRM portal.</p>` +
          `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
          `  <p style="margin: 5px 0;"><strong>Task Title:</strong> ${task.title}</p>` +
          `  <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="font-weight: bold; color: ${task.priority === 'URGENT' || task.priority === 'HIGH' ? '#e11d48' : '#4f46e5'}">${task.priority}</span></p>` +
          `  <p style="margin: 5px 0;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` +
          `  <p style="margin: 5px 0;"><strong>Assigned By:</strong> ${creator.name}</p>` +
          `</div>` +
          `<p><a href="${taskBoardUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Go to Task Board</a></p>` +
          `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">Best regards,<br/>Operations Team, ${companyName}</p>` +
          `</div>`
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Task assignment email successfully sent to ${assignee.email} (Message ID: ${info.messageId})`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal Email Preview URL: ${previewUrl}`);
    }
    return info;
  } catch (error) {
    console.error(`Failed to send task assignment email to ${assignee.email}:`, error);
  }
};

const sendNewTicketNotificationEmail = async (admin, ticket, creator) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const ticketsUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets`;

  const mailOptions = {
    from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
    to: admin.email,
    subject: `[New Ticket] ${ticket.title}`,
    text: `Hello ${admin.name},\n\n` +
          `A new ticket has been raised by ${creator.name}:\n` +
          `- Title: ${ticket.title}\n` +
          `- Category: ${ticket.category}\n\n` +
          `Please review and assign this ticket: ${ticketsUrl}\n\n` +
          `Best regards,\n` +
          `CRM System Notification`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
          `<h2 style="color: #f59e0b; margin-bottom: 20px;">New Ticket Raised</h2>` +
          `<p>Hello <strong>${admin.name}</strong>,</p>` +
          `<p>A new support/operational ticket has been raised on the CRM portal.</p>` +
          `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
          `  <p style="margin: 5px 0;"><strong>Title:</strong> ${ticket.title}</p>` +
          `  <p style="margin: 5px 0;"><strong>Category:</strong> ${ticket.category}</p>` +
          `  <p style="margin: 5px 0;"><strong>Raised By:</strong> ${creator.name}</p>` +
          `</div>` +
          `<p><a href="${ticketsUrl}" style="display: inline-block; background-color: #f59e0b; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Review Tickets</a></p>` +
          `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">CRM System Notification</p>` +
          `</div>`
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`New ticket email successfully sent to Admin ${admin.email} (Message ID: ${info.messageId})`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal Email Preview URL: ${previewUrl}`);
    }
    return info;
  } catch (error) {
    console.error(`Failed to send ticket email to Admin ${admin.email}:`, error);
  }
};

const sendTicketUpdateEmail = async (creator, ticket, message) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const ticketsUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tickets`;

  const mailOptions = {
    from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
    to: creator.email,
    subject: `Ticket Updated: ${ticket.title}`,
    text: `Hello ${creator.name},\n\n` +
          `Your ticket "${ticket.title}" has an update:\n` +
          `${message}\n\n` +
          `You can view your ticket status here: ${ticketsUrl}\n\n` +
          `Best regards,\n` +
          `Support Team, ${companyName}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
          `<h2 style="color: #10b981; margin-bottom: 20px;">Ticket Updated</h2>` +
          `<p>Hello <strong>${creator.name}</strong>,</p>` +
          `<p>Your ticket has been updated on the CRM portal.</p>` +
          `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
          `  <p style="margin: 5px 0;"><strong>Ticket:</strong> ${ticket.title}</p>` +
          `  <p style="margin: 5px 0;"><strong>Update:</strong> ${message}</p>` +
          `</div>` +
          `<p><a href="${ticketsUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Ticket</a></p>` +
          `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">Best regards,<br/>Support Team, ${companyName}</p>` +
          `</div>`
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Ticket update email successfully sent to ${creator.email} (Message ID: ${info.messageId})`);
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`Ethereal Email Preview URL: ${previewUrl}`);
    }
    return info;
  } catch (error) {
    console.error(`Failed to send ticket update email to ${creator.email}:`, error);
  }
};

const sendTaskStatusUpdateEmail = async (recipient, task, intern, status) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const taskBoardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tasks`;

  let actionText = status === 'IN_PROGRESS' ? 'started working on' : 'submitted work for review on';
  let subjectText = status === 'IN_PROGRESS' ? `[In Progress] Task: ${task.title}` : `[Submitted] Task Review: ${task.title}`;

  const mailOptions = {
    from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
    to: recipient.email,
    subject: subjectText,
    text: `Hello ${recipient.name},\n\n` +
          `Intern ${intern.name} has ${actionText} the task "${task.title}".\n` +
          `- Current Status: ${status}\n` +
          `- Updated At: ${new Date().toLocaleString()}\n\n` +
          `Please check the CRM Task Board for details: ${taskBoardUrl}\n\n` +
          `Best regards,\n` +
          `CRM Notification Service`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
          `<h2 style="color: #4f46e5; margin-bottom: 20px;">Task Status Updated</h2>` +
          `<p>Hello <strong>${recipient.name}</strong>,</p>` +
          `<p>Intern <strong>${intern.name}</strong> has ${actionText} the task <strong>"${task.title}"</strong>.</p>` +
          `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
          `  <p style="margin: 5px 0;"><strong>Task:</strong> ${task.title}</p>` +
          `  <p style="margin: 5px 0;"><strong>Updated Status:</strong> <span style="font-weight: bold; color: #4f46e5;">${status}</span></p>` +
          `  <p style="margin: 5px 0;"><strong>Updated By:</strong> ${intern.name}</p>` +
          `</div>` +
          `<p><a href="${taskBoardUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Go to Task Board</a></p>` +
          `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">CRM Notification Service</p>` +
          `</div>`
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Task status update email successfully sent to ${recipient.email} (Message ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`Failed to send task status update email to ${recipient.email}:`, error);
  }
};

const sendTeamTaskAssignmentEmail = async (team, task, creator, leader, members) => {
  const mailTransporter = await getTransporter();
  const companyName = process.env.COMPANY_NAME || 'MRF Enterprise';
  const taskBoardUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/tasks`;

  // 1. Notify the Team Leader (if exists)
  if (leader) {
    const leaderMailOptions = {
      from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
      to: leader.email,
      subject: `New Team Task Assigned to "${team.name}"`,
      text: `Hello ${leader.name},\n\n` +
            `A new team task has been assigned to your team "${team.name}": "${task.title}".\n` +
            `- Priority: ${task.priority}\n` +
            `- Deadline: ${new Date(task.deadline).toLocaleDateString()}\n` +
            `- Assigned By: ${creator.name}\n\n` +
            `Your team interns will each receive a copy of this task.\n` +
            `Please track details on the CRM Task Board: ${taskBoardUrl}\n\n` +
            `Best regards,\n` +
            `Operations Team, ${companyName}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
            `<h2 style="color: #4f46e5; margin-bottom: 20px;">New Team Task Assigned</h2>` +
            `<p>Hello <strong>${leader.name}</strong>,</p>` +
            `<p>A new team task has been assigned to your team <strong>"${team.name}"</strong> by <strong>${creator.name}</strong>.</p>` +
            `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
            `  <p style="margin: 5px 0;"><strong>Task Title:</strong> ${task.title}</p>` +
            `  <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="font-weight: bold; color: ${task.priority === 'URGENT' || task.priority === 'HIGH' ? '#e11d48' : '#4f46e5'}">${task.priority}</span></p>` +
            `  <p style="margin: 5px 0;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` +
            `  <p style="margin: 5px 0;"><strong>Team:</strong> ${team.name}</p>` +
            `</div>` +
            `<p>Each intern in your team has been assigned an individual copy of this task.</p>` +
            `<p><a href="${taskBoardUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Review Team Tasks</a></p>` +
            `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">Best regards,<br/>Operations Team, ${companyName}</p>` +
            `</div>`
    };

    try {
      await mailTransporter.sendMail(leaderMailOptions);
      console.log(`Team task assignment notification sent to TL ${leader.email}`);
    } catch (err) {
      console.error(`Failed to send team task email to TL ${leader.email}:`, err);
    }
  }

  // 2. Notify the Intern members of the team
  for (let member of members) {
    if (member.user && member.user.role === 'INTERN') {
      const memberMailOptions = {
        from: `"${companyName}" <${process.env.SENDER_EMAIL || 'no-reply@enterprise-crm.com'}>`,
        to: member.user.email,
        subject: `New Team Task for "${team.name}": ${task.title}`,
        text: `Hello ${member.user.name},\n\n` +
              `A new task has been assigned to your team "${team.name}": "${task.title}".\n` +
              `- Priority: ${task.priority}\n` +
              `- Deadline: ${new Date(task.deadline).toLocaleDateString()}\n` +
              `- Assigned By: ${creator.name}\n\n` +
              `This task has been added to your individual Kanban Board.\n` +
              `Please check your details: ${taskBoardUrl}\n\n` +
              `Best regards,\n` +
              `Operations Team, ${companyName}`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">` +
              `<h2 style="color: #4f46e5; margin-bottom: 20px;">New Team Task Assigned</h2>` +
              `<p>Hello <strong>${member.user.name}</strong>,</p>` +
              `<p>A new task has been assigned to your team <strong>"${team.name}"</strong>.</p>` +
              `<div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">` +
              `  <p style="margin: 5px 0;"><strong>Task Title:</strong> ${task.title}</p>` +
              `  <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="font-weight: bold; color: ${task.priority === 'URGENT' || task.priority === 'HIGH' ? '#e11d48' : '#4f46e5'}">${task.priority}</span></p>` +
              `  <p style="margin: 5px 0;"><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleDateString()}</p>` +
              `</div>` +
              `<p><a href="${taskBoardUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Task</a></p>` +
              `<p style="margin-top: 30px; font-size: 0.875rem; color: #64748b;">Best regards,<br/>Operations Team, ${companyName}</p>` +
              `</div>`
      };

      try {
        await mailTransporter.sendMail(memberMailOptions);
        console.log(`Team task assignment notification sent to Intern member ${member.user.email}`);
      } catch (err) {
        console.error(`Failed to send team task email to Intern member ${member.user.email}:`, err);
      }
    }
  }
};

module.exports = {
  sendWelcomeEmail,
  sendTaskAssignmentEmail,
  sendNewTicketNotificationEmail,
  sendTicketUpdateEmail,
  sendTaskStatusUpdateEmail,
  sendTeamTaskAssignmentEmail
};
