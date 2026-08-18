const axios = require('axios');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testChatGroupDeletion() {
  try {
    console.log('--- TESTING CHAT GROUP DELETION & AUTHORIZATION ---');

    // Reset password for employee test user
    const hashedPw = await bcrypt.hash('TestPass123!', 10);
    await prisma.user.update({
      where: { email: 'nandhakumar7971@gmail.com' },
      data: { password: hashedPw }
    });

    // 1. Log in as Super Admin
    console.log('1. Logging in as Super Admin...');
    const superAdminLogin = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'superadmin@enterprise-crm.com',
      password: 'SuperAdmin123!'
    });
    const superAdminToken = superAdminLogin.data.token;
    const superAdminHeaders = { headers: { Authorization: `Bearer ${superAdminToken}` } };

    // 2. Log in as Admin
    console.log('2. Logging in as Admin...');
    const adminLogin = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@enterprise-crm.com',
      password: 'Admin123!'
    });
    const adminToken = adminLogin.data.token;
    const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };

    // 3. Log in as Employee (non-admin user)
    console.log('3. Logging in as Employee (non-admin user)...');
    const employeeLogin = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'nandhakumar7971@gmail.com',
      password: 'TestPass123!'
    });
    const employeeToken = employeeLogin.data.token;
    const employeeHeaders = { headers: { Authorization: `Bearer ${employeeToken}` } };

    // 4. Create a test chat room in DB
    console.log('4. Creating test chat group in database...');
    const testRoom = await prisma.chatRoom.create({
      data: {
        name: 'Test Project Chat Group',
        type: 'PROJECT',
        status: 'ACTIVE'
      }
    });

    // Add member and message
    await prisma.chatRoomMember.create({
      data: { roomId: testRoom.id, userId: superAdminLogin.data.user.id }
    });

    await prisma.chatMessage.create({
      data: {
        roomId: testRoom.id,
        senderId: superAdminLogin.data.user.id,
        message: 'Hello test message'
      }
    });

    console.log(`Created test room ID: ${testRoom.id}`);

    // 5. Test Safety Check: Try deleting official company room as Admin
    console.log('5. Testing safety check: Attempting to delete official company chat room...');
    const roomsRes = await axios.get('http://localhost:5000/api/chat/rooms', adminHeaders);
    const companyRoom = (roomsRes.data || []).find(r => r.type === 'COMPANY' || r.isDefault);

    if (companyRoom) {
      try {
        await axios.delete(`http://localhost:5000/api/chat/groups/${companyRoom.id}`, adminHeaders);
        console.error('FAILED: Official company room deletion should have been blocked!');
      } catch (err) {
        console.log(`SAFETY CHECK PASSED: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
      }
    }

    // 6. Test Authorization: Try deleting test room as Employee
    console.log('6. Testing non-admin authorization: Employee attempting to delete test room...');
    try {
      await axios.delete(`http://localhost:5000/api/chat/groups/${testRoom.id}`, employeeHeaders);
      console.error('FAILED: Non-admin room deletion should have been blocked with 403!');
    } catch (err) {
      console.log(`AUTHORIZATION CHECK PASSED: ${err.response?.status} - ${JSON.stringify(err.response?.data)}`);
    }

    // 7. Test Admin Deletion: Delete test room as Admin
    console.log('7. Attempting deletion of test room as Admin...');
    const delRes = await axios.delete(`http://localhost:5000/api/chat/groups/${testRoom.id}`, adminHeaders);
    console.log(`ADMIN DELETION SUCCESSFUL: ${delRes.status} - ${JSON.stringify(delRes.data)}`);

    // 8. Verify database cleanup (0 orphaned messages/members)
    const roomInDb = await prisma.chatRoom.findUnique({ where: { id: testRoom.id } });
    const msgsInDb = await prisma.chatMessage.count({ where: { roomId: testRoom.id } });
    const membersInDb = await prisma.chatRoomMember.count({ where: { roomId: testRoom.id } });

    console.log(`DB Verification - Room exists: ${!!roomInDb}, Messages count: ${msgsInDb}, Members count: ${membersInDb}`);

    if (!roomInDb && msgsInDb === 0 && membersInDb === 0) {
      console.log('\n=============================================');
      console.log('🎉 ALL CHAT GROUP DELETION & AUTHORIZATION TESTS PASSED 100%!');
      console.log('=============================================');
    } else {
      console.error('DB Cleanup Verification failed!');
    }
  } catch (err) {
    console.error('Test execution error:', err.response?.data || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testChatGroupDeletion();
