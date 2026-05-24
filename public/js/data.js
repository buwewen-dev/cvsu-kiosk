/* ============================================
   CvSU Kiosk - Sample Data
   This is mock data for the prototype demo.
   In production, this will come from a MySQL/Laravel backend.
   ============================================ */

const DATA = {

  // ============ STUDENTS ============
  students: [
    { id: '202301234', name: 'Railey Mae D. Agedio', course: 'BSCS', year: 4, email: 'rmagedio@cvsu.edu.ph' },
    { id: '202300001', name: 'Althea Balicat', course: 'BSCS', year: 4, email: 'abalicat@cvsu.edu.ph' },
    { id: '202300002', name: 'Florence Sophia V. Diaz', course: 'BSCS', year: 4, email: 'fdiaz@cvsu.edu.ph' },
    { id: '202300003', name: 'Aicee Emari H. Estores', course: 'BSCS', year: 4, email: 'aestores@cvsu.edu.ph' },
    { id: '202300004', name: 'Alexis F. Ornales', course: 'BSCS', year: 4, email: 'aornales@cvsu.edu.ph' },
    { id: '202401111', name: 'Juan Dela Cruz', course: 'BSIT', year: 1, email: 'jdc@cvsu.edu.ph' },
  ],

  // ============ OFFICES ============
  offices: [
    {
      id: 'registrar',
      name: 'Registrar',
      full: 'Office of the University Registrar',
      desc: 'Handles academic records, transcripts, and enrollment documents.',
      color: '#0E5732',
      building: 'admin',
      room: 'Admin Bldg, Rm 101',
      iconSvg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'
    },
    {
      id: 'cashier',
      name: 'Cashier',
      full: 'University Cashier',
      desc: 'Receives payments for tuition, fees, and document requests.',
      color: '#E53935',
      building: 'cashier',
      room: 'Cashier Bldg, Window 1-3',
      iconSvg: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>'
    },
    {
      id: 'osas',
      name: 'OSAS',
      full: 'Office of Student Affairs and Services',
      desc: 'Issues good moral certificates, handles scholarships and student concerns.',
      color: '#1E88E5',
      building: 'admin',
      room: 'Admin Bldg, Rm 105',
      iconSvg: '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>'
    },
  ],

  // ============ DOCUMENTS ============
  documents: [
    { id: 'tor',       office: 'registrar', name: 'Transcript of Records', fee: 250, days: 5, desc: 'Official academic transcript' },
    { id: 'cog',       office: 'registrar', name: 'Certificate of Grades', fee: 100, days: 3, desc: 'Per semester grade certificate' },
    { id: 'coe',       office: 'registrar', name: 'Certificate of Enrollment', fee: 80, days: 1, desc: 'Proof of current enrollment' },
    { id: 'diploma',   office: 'registrar', name: 'Diploma (Copy)', fee: 350, days: 7, desc: 'Certified copy of diploma' },
    { id: 'gmc',       office: 'osas',      name: 'Good Moral Certificate', fee: 100, days: 2, desc: 'Conduct certification from OSAS' },
    { id: 'reco',      office: 'osas',      name: 'Recommendation Letter', fee: 50, days: 3, desc: 'For scholarships or work' },
    { id: 'clearance', office: 'osas',      name: 'Student Clearance', fee: 80, days: 1, desc: 'Required for graduation and shifting' },
    { id: 'orprint',   office: 'cashier',   name: 'Official Receipt (Reprint)', fee: 30, days: 1, desc: 'Replacement copy of past receipt' },
  ],

  // ============ ANNOUNCEMENTS ============
  announcements: [
    {
      id: 1,
      type: 'event',
      featured: true,
      title: 'CvSU Cavite City Foundation Day 2026',
      body: 'Join us on June 12, 2026 for a full day of activities, performances, alumni reunion, and the unveiling of the new IT building wing. Open to all students, faculty, and the community.',
      date: 'June 12, 2026',
      author: 'OSAS'
    },
    {
      id: 2,
      type: 'academic',
      title: 'Enrollment for 1st Semester AY 2026-2027',
      body: 'Online pre-enrollment runs from July 22 to August 9. On-site enrollment begins August 12 at the Registrar.',
      date: 'July 22, 2026',
      author: 'Registrar'
    },
    {
      id: 3,
      type: 'reminder',
      title: 'Cashier window hours updated',
      body: 'Effective May 26, 2026: Cashier accepts payments from 8:00 AM to 4:30 PM, Monday to Friday.',
      date: 'May 26, 2026',
      author: 'Cashier'
    },
    {
      id: 4,
      type: 'news',
      title: 'New e-wallet payment now available',
      body: 'You can now pay your document requests through GCash, Maya, and any QR Ph compatible app right from this kiosk.',
      date: 'May 18, 2026',
      author: 'IT Office'
    },
    {
      id: 5,
      type: 'event',
      title: 'IT Week 2026 Hackathon',
      body: 'Form a team of 3 and join the 24-hour campus hackathon. Cash prizes and internship offers from local tech firms.',
      date: 'July 8, 2026',
      author: 'IT Department'
    },
    {
      id: 6,
      type: 'academic',
      title: 'Library extended hours for finals week',
      body: 'Library will be open until 10:00 PM from May 27 to June 7, 2026 to support students during the finals week.',
      date: 'May 25, 2026',
      author: 'Library'
    },
    {
      id: 7,
      type: 'reminder',
      title: 'Clearance signing schedule for graduating students',
      body: 'Graduating BSCS and BSIT students may begin clearance signing starting June 1, 2026 at OSAS.',
      date: 'June 1, 2026',
      author: 'OSAS'
    },
  ],

  // ============ FAQs ============
  faqs: [
    {
      cat: 'Registrar',
      q: 'How long does it take to process my Transcript of Records?',
      a: 'A regular TOR takes 5 working days from the date of payment. Rush requests are not available at this time. You will receive a release date on your receipt.'
    },
    {
      cat: 'Registrar',
      q: 'What documents do I need to request a Certificate of Enrollment?',
      a: 'Just your valid Student ID and proof of payment. The certificate is processed in 1 working day for most requests.'
    },
    {
      cat: 'Registrar',
      q: 'Can someone else claim my document for me?',
      a: 'Yes. The authorized representative must bring a signed authorization letter, a photocopy of your Student ID, and their own valid ID.'
    },
    {
      cat: 'Cashier',
      q: 'What payment methods are accepted?',
      a: 'You can pay in cash at the Cashier window or use any QR Ph compatible e-wallet (GCash, Maya, BPI, GrabPay) at this kiosk.'
    },
    {
      cat: 'Cashier',
      q: 'Can I get a refund for a cancelled request?',
      a: 'Refunds are processed within 7 working days. Please visit the Cashier with your original receipt and a written request.'
    },
    {
      cat: 'OSAS',
      q: 'What is the requirement for a Good Moral Certificate?',
      a: 'A valid Student ID and proof of payment. Processing takes 2 working days.'
    },
    {
      cat: 'OSAS',
      q: 'How can I apply for a scholarship?',
      a: 'Visit OSAS during office hours and ask for the scholarship application form. You may also check the OSAS bulletin board for current openings.'
    },
    {
      cat: 'General',
      q: 'Where can I find the Registrar office?',
      a: 'The Registrar is located at the Administration Building, Room 101. Tap "Campus Map" on the main menu for directions.'
    },
    {
      cat: 'General',
      q: 'What are the kiosk operating hours?',
      a: 'The kiosk is available 24/7 for inquiries, announcements, and FAQs. Document processing is subject to office hours (8:00 AM to 4:30 PM, Monday to Friday).'
    },
    {
      cat: 'General',
      q: 'I forgot my reference number. What should I do?',
      a: 'Visit the office where you made the request with your Student ID. They can look up your transaction using your name and date of request.'
    },
  ],

  // ============ BUILDINGS (campus map) ============
  buildings: {
    admin: {
      name: 'Administration Building',
      category: 'Administrative',
      desc: 'The main administrative hub of the campus, housing the Registrar, OSAS, and other student services.',
      offices: [
        { name: 'Office of the Registrar', room: 'Rm 101' },
        { name: 'Office of Student Affairs and Services', room: 'Rm 105' },
        { name: 'Campus Director\'s Office', room: 'Rm 201' },
        { name: 'Accounting Office', room: 'Rm 110' },
      ]
    },
    academic: {
      name: 'IT Building',
      category: 'Academic',
      desc: 'Houses the Department of Information Technology, including the Computer Science and IT programs, computer laboratories, and faculty offices.',
      offices: [
        { name: 'Department of Information Technology', room: 'Rm 301' },
        { name: 'Computer Laboratory 1', room: 'Rm 302' },
        { name: 'Computer Laboratory 2', room: 'Rm 303' },
        { name: 'IT Faculty Room', room: 'Rm 305' },
      ]
    },
    cashier: {
      name: 'Cashier Building',
      category: 'Administrative',
      desc: 'Receives payments for tuition, miscellaneous fees, document requests, and other university fees.',
      offices: [
        { name: 'Cashier Window 1', room: 'Window 1' },
        { name: 'Cashier Window 2', room: 'Window 2' },
        { name: 'Cashier Window 3', room: 'Window 3' },
      ]
    },
    library: {
      name: 'University Library',
      category: 'Academic',
      desc: 'Quiet study spaces, computer stations, group discussion rooms, and over 20,000 books across all disciplines.',
      offices: [
        { name: 'Circulation Section', room: 'Ground Floor' },
        { name: 'Reference Section', room: 'Ground Floor' },
        { name: 'Computer Section', room: '2nd Floor' },
        { name: 'Discussion Rooms', room: '2nd Floor' },
      ]
    },
    gym: {
      name: 'University Gymnasium',
      category: 'Facility',
      desc: 'Multi-purpose gymnasium used for sports events, university assemblies, and large gatherings.',
      offices: [
        { name: 'Sports Equipment Room', room: 'Ground Floor' },
        { name: 'Locker Rooms', room: 'Ground Floor' },
      ]
    },
  },

  // ============ LIVE QUEUE STATE ============
  queues: {
    registrar: { current: 23, total_today: 41, waiting: 18, avg_min: 4 },
    cashier:   { current: 11, total_today: 28, waiting: 17, avg_min: 2 },
    osas:      { current: 7,  total_today: 13, waiting: 6,  avg_min: 3 },
  },
};
