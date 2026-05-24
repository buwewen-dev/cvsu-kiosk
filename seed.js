/* Seeds the database with initial sample data if tables are empty. */

const bcrypt = require('bcryptjs');
const { query, get, run } = require('./db');

async function seed() {
  const userCount = await get('SELECT COUNT(*) AS c FROM users');
  if (parseInt(userCount.c) > 0) {
    console.log('[seed] Database already has data, skipping.');
    return;
  }

  console.log('[seed] Seeding database...');

  // ============ USERS ============
  const passHash = (p) => bcrypt.hashSync(p, 10);
  await run('INSERT INTO users (username, password_hash, role, office_id, name, active) VALUES (?, ?, ?, ?, ?, ?)',
    ['admin', passHash('admin123'), 'system_admin', null, 'System Administrator', 1]);
  await run('INSERT INTO users (username, password_hash, role, office_id, name, active) VALUES (?, ?, ?, ?, ?, ?)',
    ['registrar', passHash('reg123'), 'office_admin', 'registrar', 'Registrar Staff', 1]);
  await run('INSERT INTO users (username, password_hash, role, office_id, name, active) VALUES (?, ?, ?, ?, ?, ?)',
    ['cashier', passHash('cash123'), 'office_admin', 'cashier', 'Cashier Staff', 1]);
  await run('INSERT INTO users (username, password_hash, role, office_id, name, active) VALUES (?, ?, ?, ?, ?, ?)',
    ['osas', passHash('osas123'), 'office_admin', 'osas', 'OSAS Staff', 1]);

  // ============ OFFICES ============
  const offices = [
    ['registrar', 'Registrar', 'Office of the University Registrar', 'Handles academic records, transcripts, and enrollment documents.', '#0E5732', 'admin', 'Admin Bldg, Rm 101', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'],
    ['cashier', 'Cashier', 'University Cashier', 'Receives payments for tuition, fees, and document requests.', '#E53935', 'cashier', 'Cashier Bldg, Window 1-3', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>'],
    ['osas', 'OSAS', 'Office of Student Affairs and Services', 'Issues good moral certificates, handles scholarships and student concerns.', '#1E88E5', 'admin', 'Admin Bldg, Rm 105', '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'],
  ];
  for (const o of offices) {
    await run('INSERT INTO offices (id, name, full_name, description, color, building, room, icon_svg, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)', o);
    await run('INSERT INTO queue_state (office_id, current_number, last_issued) VALUES (?, ?, ?)', [o[0], 0, 0]);
  }

  // ============ OFFICE CAPACITY (releases per hour) ============
  await run('INSERT INTO office_capacity (office_id, per_hour, hours_start, hours_end) VALUES (?, ?, ?, ?)', ['registrar', 20, '08:00', '17:00']);
  await run('INSERT INTO office_capacity (office_id, per_hour, hours_start, hours_end) VALUES (?, ?, ?, ?)', ['cashier',   30, '08:00', '16:30']);
  await run('INSERT INTO office_capacity (office_id, per_hour, hours_start, hours_end) VALUES (?, ?, ?, ?)', ['osas',      15, '08:00', '17:00']);

  // Sample pending inquiries so admin has something to demo
  await run('INSERT INTO inquiries (question, student_email, student_name, student_id, office_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    ['How much is the express fee for a Transcript of Records and how many days will it take?', 'juan.dlc@cvsu.edu.ph', 'Juan Dela Cruz', '202401111', 'registrar', 'pending']);
  await run('INSERT INTO inquiries (question, student_email, student_name, student_id, office_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    ['Can I pay my Good Moral fee online through GCash even if I will claim the document next week?', 'maria.s@cvsu.edu.ph', 'Maria Santos', '202401112', 'cashier', 'pending']);
  await run('INSERT INTO inquiries (question, student_email, student_name, student_id, office_id, status) VALUES (?, ?, ?, ?, ?, ?)',
    ['What are the requirements to apply for a scholarship under OSAS this semester?', 'pedro.r@cvsu.edu.ph', 'Pedro Reyes', '202401113', 'osas', 'pending']);

  // ============ DOCUMENTS ============
  const docs = [
    ['tor', 'registrar', 'Transcript of Records', 'Official academic transcript', 250, 5],
    ['cog', 'registrar', 'Certificate of Grades', 'Per semester grade certificate', 100, 3],
    ['coe', 'registrar', 'Certificate of Enrollment', 'Proof of current enrollment', 80, 1],
    ['diploma', 'registrar', 'Diploma (Copy)', 'Certified copy of diploma', 350, 7],
    ['gmc', 'osas', 'Good Moral Certificate', 'Conduct certification from OSAS', 100, 2],
    ['reco', 'osas', 'Recommendation Letter', 'For scholarships or work', 50, 3],
    ['clearance', 'osas', 'Student Clearance', 'Required for graduation and shifting', 80, 1],
    ['orprint', 'cashier', 'Official Receipt (Reprint)', 'Replacement copy of past receipt', 30, 1],
  ];
  for (const d of docs) {
    await run('INSERT INTO documents (id, office_id, name, description, fee, processing_days, active) VALUES (?, ?, ?, ?, ?, ?, 1)', d);
  }

  // ============ STUDENTS ============
  const students = [
    ['202301234', 'Railey Mae D. Agedio', 'BSCS', 4, 'rmagedio@cvsu.edu.ph'],
    ['202300001', 'Althea Balicat', 'BSCS', 4, 'abalicat@cvsu.edu.ph'],
    ['202300002', 'Florence Sophia V. Diaz', 'BSCS', 4, 'fdiaz@cvsu.edu.ph'],
    ['202300003', 'Aicee Emari H. Estores', 'BSCS', 4, 'aestores@cvsu.edu.ph'],
    ['202300004', 'Alexis F. Ornales', 'BSCS', 4, 'aornales@cvsu.edu.ph'],
    ['202401111', 'Juan Dela Cruz', 'BSIT', 1, 'jdc@cvsu.edu.ph'],
    ['202401112', 'Maria Santos', 'BSIT', 2, 'msantos@cvsu.edu.ph'],
    ['202401113', 'Pedro Reyes', 'BSCS', 3, 'preyes@cvsu.edu.ph'],
  ];
  for (const s of students) {
    await run('INSERT INTO students (id, name, course, year, email) VALUES (?, ?, ?, ?, ?)', s);
  }

  // ============ ANNOUNCEMENTS ============
  const announcements = [
    ['event', 1, 'CvSU Cavite City Foundation Day 2026', 'Join us on June 12, 2026 for a full day of activities, performances, alumni reunion, and the unveiling of the new IT building wing. Open to all students, faculty, and the community.', 'June 12, 2026', 'OSAS', 'osas'],
    ['academic', 0, 'Enrollment for 1st Semester AY 2026-2027', 'Online pre-enrollment runs from July 22 to August 9. On-site enrollment begins August 12 at the Registrar.', 'July 22, 2026', 'Registrar', 'registrar'],
    ['reminder', 0, 'Cashier window hours updated', 'Effective May 26, 2026. Cashier accepts payments from 8:00 AM to 4:30 PM, Monday to Friday.', 'May 26, 2026', 'Cashier', 'cashier'],
    ['news', 0, 'New e-wallet payment now available', 'You can now pay your document requests through GCash, Maya, and any QR Ph compatible app right from this kiosk.', 'May 18, 2026', 'IT Office', null],
    ['event', 0, 'IT Week 2026 Hackathon', 'Form a team of 3 and join the 24-hour campus hackathon. Cash prizes and internship offers from local tech firms.', 'July 8, 2026', 'IT Department', null],
    ['academic', 0, 'Library extended hours for finals week', 'Library will be open until 10:00 PM from May 27 to June 7, 2026 to support students during the finals week.', 'May 25, 2026', 'Library', null],
    ['reminder', 0, 'Clearance signing schedule for graduating students', 'Graduating BSCS and BSIT students may begin clearance signing starting June 1, 2026 at OSAS.', 'June 1, 2026', 'OSAS', 'osas'],
  ];
  for (const a of announcements) {
    await run('INSERT INTO announcements (type, featured, title, body, date_text, author, office_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)', a);
  }

  // ============ FAQs ============
  const faqs = [
    ['Registrar', 'How long does it take to process my Transcript of Records?', 'A regular TOR takes 5 working days from the date of payment. Rush requests are not available at this time. You will receive a release date on your receipt.', 'registrar', 1],
    ['Registrar', 'What documents do I need to request a Certificate of Enrollment?', 'Just your valid Student ID and proof of payment. The certificate is processed in 1 working day for most requests.', 'registrar', 2],
    ['Registrar', 'Can someone else claim my document for me?', 'Yes. The authorized representative must bring a signed authorization letter, a photocopy of your Student ID, and their own valid ID.', 'registrar', 3],
    ['Cashier', 'What payment methods are accepted?', 'You can pay in cash at the Cashier window or use any QR Ph compatible e-wallet (GCash, Maya, BPI, GrabPay) at this kiosk.', 'cashier', 1],
    ['Cashier', 'Can I get a refund for a cancelled request?', 'Refunds are processed within 7 working days. Please visit the Cashier with your original receipt and a written request.', 'cashier', 2],
    ['OSAS', 'What is the requirement for a Good Moral Certificate?', 'A valid Student ID and proof of payment. Processing takes 2 working days.', 'osas', 1],
    ['OSAS', 'How can I apply for a scholarship?', 'Visit OSAS during office hours and ask for the scholarship application form. You may also check the OSAS bulletin board for current openings.', 'osas', 2],
    ['General', 'Where can I find the Registrar office?', 'The Registrar is located at the Administration Building, Room 101. Tap "Campus Map" on the main menu for directions.', null, 1],
    ['General', 'What are the kiosk operating hours?', 'The kiosk is available 24/7 for inquiries, announcements, and FAQs. Document processing is subject to office hours (8:00 AM to 4:30 PM, Monday to Friday).', null, 2],
    ['General', 'I forgot my reference number. What should I do?', 'Visit the office where you made the request with your Student ID. They can look up your transaction using your name and date of request.', null, 3],
  ];
  for (const f of faqs) {
    await run('INSERT INTO faqs (category, question, answer, office_id, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)', f);
  }

  // ============ BUILDINGS ============
  const buildings = [
    ['admin', 'Administration Building', 'Administrative', 'The main administrative hub of the campus, housing the Registrar, OSAS, and other student services.'],
    ['academic', 'IT Building', 'Academic', 'Houses the Department of Information Technology, including the Computer Science and IT programs, computer laboratories, and faculty offices.'],
    ['cashier', 'Cashier Building', 'Administrative', 'Receives payments for tuition, miscellaneous fees, document requests, and other university fees.'],
    ['library', 'University Library', 'Academic', 'Quiet study spaces, computer stations, group discussion rooms, and over 20,000 books across all disciplines.'],
    ['gym', 'University Gymnasium', 'Facility', 'Multi-purpose gymnasium used for sports events, university assemblies, and large gatherings.'],
  ];
  for (const b of buildings) {
    await run('INSERT INTO buildings (id, name, category, description) VALUES (?, ?, ?, ?)', b);
  }

  const bldgOffices = [
    ['admin', 'Office of the Registrar', 'Rm 101'],
    ['admin', 'Office of Student Affairs and Services', 'Rm 105'],
    ['admin', "Campus Director's Office", 'Rm 201'],
    ['admin', 'Accounting Office', 'Rm 110'],
    ['academic', 'Department of Information Technology', 'Rm 301'],
    ['academic', 'Computer Laboratory 1', 'Rm 302'],
    ['academic', 'Computer Laboratory 2', 'Rm 303'],
    ['academic', 'IT Faculty Room', 'Rm 305'],
    ['cashier', 'Cashier Window 1', 'Window 1'],
    ['cashier', 'Cashier Window 2', 'Window 2'],
    ['cashier', 'Cashier Window 3', 'Window 3'],
    ['library', 'Circulation Section', 'Ground Floor'],
    ['library', 'Reference Section', 'Ground Floor'],
    ['library', 'Computer Section', '2nd Floor'],
    ['library', 'Discussion Rooms', '2nd Floor'],
    ['gym', 'Sports Equipment Room', 'Ground Floor'],
    ['gym', 'Locker Rooms', 'Ground Floor'],
  ];
  for (const bo of bldgOffices) {
    await run('INSERT INTO building_offices (building_id, office_name, room) VALUES (?, ?, ?)', bo);
  }

  // ============ MISSION ============
  await run('INSERT INTO mission_vision (vision, mission, core_values) VALUES (?, ?, ?)', [
    'The premier university in historic Cavite globally recognized for excellence in character development, academics, research, innovation, and sustainable community engagement.',
    'Cavite State University shall provide excellent, equitable and relevant educational opportunities in the arts, sciences and technology through quality instruction and responsive research and development activities. It shall produce professional, skilled and morally upright individuals for global competitiveness.',
    'Truth . Excellence . Service'
  ]);

  // ============ SAMPLE REQUESTS (for admin dashboard demo) ============
  const sampleRequests = [
    ['REG-20260520-1001', 1, '202401111', 'Juan Dela Cruz', 'registrar', 'coe', 'Certificate of Enrollment', 80, 'released', 'cash', 1, '2026-05-21'],
    ['REG-20260522-1002', 2, '202401112', 'Maria Santos', 'registrar', 'cog', 'Certificate of Grades', 100, 'ready', 'ewallet', 1, '2026-05-25'],
    ['OSA-20260523-2001', 1, '202401113', 'Pedro Reyes', 'osas', 'gmc', 'Good Moral Certificate', 100, 'processing', 'ewallet', 1, '2026-05-26'],
    ['REG-20260524-1003', 3, '202300002', 'Florence Sophia V. Diaz', 'registrar', 'tor', 'Transcript of Records', 250, 'processing', 'ewallet', 1, '2026-05-29'],
    ['CAS-20260524-3001', 1, '202300003', 'Aicee Emari H. Estores', 'cashier', 'orprint', 'Official Receipt (Reprint)', 30, 'pending', 'cash', 0, '2026-05-25'],
  ];
  for (const r of sampleRequests) {
    await run('INSERT INTO requests (ref_number, queue_number, student_id, student_name, office_id, document_id, document_name, fee, status, payment_method, paid, release_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
  }

  // Update queue state to reflect existing requests
  await run('UPDATE queue_state SET last_issued = 3, current_number = 2 WHERE office_id = ?', ['registrar']);
  await run('UPDATE queue_state SET last_issued = 1, current_number = 1 WHERE office_id = ?', ['cashier']);
  await run('UPDATE queue_state SET last_issued = 1, current_number = 0 WHERE office_id = ?', ['osas']);

  console.log('[seed] Done. Default credentials:');
  console.log('  System Admin: admin / admin123');
  console.log('  Registrar:    registrar / reg123');
  console.log('  Cashier:      cashier / cash123');
  console.log('  OSAS:         osas / osas123');
  console.log('  Demo Student: 202301234 (Railey Mae Agedio)');
}

module.exports = { seed };
