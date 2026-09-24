import { User } from '../types';

/**
 * Real Bahrain Pharmacy Team & Staff
 * Synced with system users and pharmacists database tables.
 * CPR is Bahrain national ID formatted as 9 digits (masked per Section 9).
 */
export const MOCK_USERS: User[] = [
  // ── 1. Admin ──────────────────────────────────────────────
  {
    id: 'usr-admin-tabarak',
    name: 'Dr. Sarah Al-Khaja',
    cpr: '880192841',
    role: 'admin'
  },

  // ── 2. Supervisors ────────────────────────────────────────
  {
    id: 'a8074b0d-669e-4d4e-8ff3-ab0219e35790',
    name: 'Dr. Abdelrahman Ahmed (Area 1 Supervisor)',
    cpr: '850381927',
    role: 'supervisor'
  },
  {
    id: 'b455e337-3202-4835-8d81-508729195268',
    name: 'Dr. Hisham Eldallash (Area 2 Supervisor)',
    cpr: '891048293',
    role: 'supervisor'
  },

  // ── 3. Branch Managers ────────────────────────────────────
  { id: 'usr-bm-t001', name: 'WEAM KHATTAB', cpr: '900214829', role: 'branch_manager', branch_id: '1b3b2924-ef34-4626-a77f-33227f2915ad' },
  { id: 'usr-bm-t003', name: 'FATMA AWAD', cpr: '910328491', role: 'branch_manager', branch_id: '35448ef7-1b91-4d48-8ad6-73fcfe020767' },
  { id: 'usr-bm-t005', name: 'AYMAN KHALIL', cpr: '870419283', role: 'branch_manager', branch_id: '2cb10ffc-fa88-49c9-9b72-a13089c51879' },
  { id: 'usr-bm-t008', name: 'NADA MOSTAFA', cpr: '930819201', role: 'branch_manager', branch_id: '575225e6-4dcb-4fd0-806b-e09fc6508477' },
  { id: 'usr-bm-s001', name: 'DALIA ABDELALL', cpr: '881293847', role: 'branch_manager', branch_id: '1b75e849-fb83-4f7c-89ec-344068a0c17c' },
  { id: 'usr-bm-h003', name: 'AREEJ YOUSSEF', cpr: '940529182', role: 'branch_manager', branch_id: '2b062ff8-aa8a-4d75-8cc1-e609c65ab161' },
  { id: 'usr-bm-h004', name: 'HALA DAHAB', cpr: '860129384', role: 'branch_manager', branch_id: '52325c35-d273-4b6f-bed1-aef28d55cc37' },

  // ── 4. Pharmacists (Real staff from pharmacists table) ────
  { id: '43ccc615-b329-4d26-b868-c032983e9b59', name: 'Dr. EBRAHIM AYOUB', cpr: '940618291', role: 'pharmacist', branch_id: '1b3b2924-ef34-4626-a77f-33227f2915ad' },
  { id: '4fedfaf6-c27e-4f76-85fe-0f09aaaad77e', name: 'Dr. DALIA ABDELALL', cpr: '950718292', role: 'pharmacist', branch_id: '1b75e849-fb83-4f7c-89ec-344068a0c17c' },
  { id: 'd052ae48-1f79-417c-87f6-01b208d1ab4b', name: 'Dr. AMIRA RADY', cpr: '920818293', role: 'pharmacist', branch_id: '35448ef7-1b91-4d48-8ad6-73fcfe020767' },
  { id: '65b2cc82-055a-4552-8fec-82cd8b40ae25', name: 'Dr. AHMED ELKHOULY', cpr: '930918294', role: 'pharmacist', branch_id: '2cb10ffc-fa88-49c9-9b72-a13089c51879' },
  { id: 'b08ed0a0-2019-4f0d-9d85-ed5d0bddafd3', name: 'Dr. AHMED ELKOMY', cpr: '910118295', role: 'pharmacist', branch_id: '575225e6-4dcb-4fd0-806b-e09fc6508477' },
  { id: '3a5e8ce7-c56c-4297-815d-68c2fb8b64ad', name: 'Dr. ABDALLA ABDELFATTAH', cpr: '900218296', role: 'pharmacist', branch_id: '52325c35-d273-4b6f-bed1-aef28d55cc37' },
  { id: '84d93be5-4e6b-420d-b27d-404925ceb364', name: 'Dr. ABDELRAHEEM SOLIMAN', cpr: '890318297', role: 'pharmacist', branch_id: '2b062ff8-aa8a-4d75-8cc1-e609c65ab161' },
  { id: 'a118bea8-3f44-4e1b-b6fe-bf4c689bcf70', name: 'Dr. ABDELRAHMAN AHMED', cpr: '940418298', role: 'pharmacist', branch_id: 'b9ddaed5-b104-4112-8dd9-dad1e1b9b7f3' },
  { id: '619c8175-6450-40fc-a061-7d138301ab5b', name: 'Dr. AHMED ABDELREHIM', cpr: '950518299', role: 'pharmacist', branch_id: 'b9b91ba2-09f8-4d0e-b271-c5ca37472629' },
  { id: '24867c37-e964-431b-b4d2-7701ee9df907', name: 'Dr. AHMED ELBAHY', cpr: '920618290', role: 'pharmacist', branch_id: '806e481f-8264-4863-aa5c-6eddd36f7d71' },
  { id: 'ae029419-c9b3-4427-b8e8-f64e391d0727', name: 'Dr. AHMED ELBARBARY', cpr: '930718291', role: 'pharmacist', branch_id: '54c9c2cd-c11f-45e9-ae8b-17af071a9706' },
  { id: 'e00b5712-e7cf-4ca6-b6e5-c399bcb04ae7', name: 'Dr. AHMED ELKENAWI', cpr: '910818292', role: 'pharmacist', branch_id: 'eb8156ab-79e8-40da-8300-1fb08de96a46' },
  { id: '5bd04e93-49b5-409a-bd2d-b0d5b1c6e7a0', name: 'Dr. AHMED ELKOUSY', cpr: '900918293', role: 'pharmacist', branch_id: 'eea51a55-f441-4ca4-a70f-2851faf0820a' },
  { id: '5afcdc34-a246-457b-bd7c-f6ff4920b0b1', name: 'Dr. ALAA BABIKER', cpr: '890118294', role: 'pharmacist', branch_id: 'f42e155a-685b-4789-bed7-c9d419160149' },
  { id: '561059b2-56cc-45bb-b825-02ca043a1009', name: 'Dr. AMINA ABELHAMID', cpr: '940218295', role: 'pharmacist', branch_id: 'ac3367db-2d37-4fbd-90f8-466a331dbe43' },
  { id: 'adfd96f5-02fd-49dd-887d-848a81222c50', name: 'Dr. AMIR MOHEMED', cpr: '950318296', role: 'pharmacist', branch_id: '8d428bcb-9594-43a9-a2f9-d684c0f7fd25' },
  { id: '431fb0c9-d79f-463c-ab83-b9c1790e18c0', name: 'Dr. AMIRA HAMADA', cpr: '920418297', role: 'pharmacist', branch_id: '61d320bb-5f30-47ff-bdcc-fa737e837088' },
  { id: 'd5e60aed-3c7b-452d-92aa-e1f11ee9836a', name: 'Dr. AYMAN KHALIL', cpr: '930518298', role: 'pharmacist', branch_id: '2cb10ffc-fa88-49c9-9b72-a13089c51879' },
  { id: 'ebfbb925-f1fa-4983-bcfa-3c6d9235fd83', name: 'Dr. FATMA AWAD', cpr: '910618299', role: 'pharmacist', branch_id: '35448ef7-1b91-4d48-8ad6-73fcfe020767' },
  { id: '68d6a1d1-3364-4b02-a622-a2f8977b5f24', name: 'Dr. HALA DAHAB', cpr: '900718290', role: 'pharmacist', branch_id: '52325c35-d273-4b6f-bed1-aef28d55cc37' }
];
