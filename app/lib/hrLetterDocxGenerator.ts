import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { RegisteredCr } from './crEntities';

export type HrLetterType =
  | 'noc_transfer'
  | 'experience_certificate'
  | 'active_employment'
  | 'embassy_salary'
  | 'bank_salary_iban'
  | 'bank_salary_undertaking';

export interface HrLetterData {
  letterType: HrLetterType;
  lang: 'ar' | 'en';
  gender?: 'male' | 'female';
  cr: RegisteredCr;
  refNo: string;
  issueDate: string;
  withoutSealAndSignature: boolean;
  employeeName: string;
  cpr: string;
  passport: string;
  nationality: string;
  jobTitle: string;
  nhraLicense?: string;
  joinDate: string;
  endDate?: string;
  basicSalary: number;
  housingAllowance: number;
  transportationAllowance: number;
  incentiveBonus: number;
  totalSalary: number;
  bankName?: string;
  iban?: string;
  destinationName?: string;
  newCompanyName?: string;
  customNotes?: string;
  customAddressee?: string;
  signatoryName?: string;
  signatoryRole?: string;
}

export const resolveNationality = (raw?: string, lang: 'ar' | 'en' = 'ar', gender: 'male' | 'female' = 'male'): string => {
  const str = (raw || '').trim();
  const isFemale = gender === 'female';
  if (!str) return lang === 'ar' ? (isFemale ? 'مصرية' : 'مصري') : 'Egyptian';

  if (lang === 'ar') {
    let nat = isFemale ? 'مصرية' : 'مصري';
    if (/egypt/i.test(str) || str.includes('مصر')) nat = isFemale ? 'مصرية' : 'مصري';
    else if (/bahrain/i.test(str) || str.includes('بحرين')) nat = isFemale ? 'بحرينية' : 'بحريني';
    else if (/saudi/i.test(str) || str.includes('سعود')) nat = isFemale ? 'سعودية' : 'سعودي';
    else if (/jordan/i.test(str) || str.includes('أردن') || str.includes('اردن')) nat = isFemale ? 'أردنية' : 'أردني';
    else if (/indian?/i.test(str) || str.includes('هند')) nat = isFemale ? 'هندية' : 'هندي';
    else if (/pakistan/i.test(str) || str.includes('باكستان')) nat = isFemale ? 'باكستانية' : 'باكستاني';
    else if (/filipino|philippine/i.test(str) || str.includes('فلبين')) nat = isFemale ? 'فلبينية' : 'فلبيني';
    else if (/syria/i.test(str) || str.includes('سور')) nat = isFemale ? 'سورية' : 'سوري';
    else if (/leban/i.test(str) || str.includes('لبنان')) nat = isFemale ? 'لبنانية' : 'لبناني';
    else if (/yemen/i.test(str) || str.includes('يمن')) nat = isFemale ? 'يمنية' : 'يمني';
    else if (/bangla/i.test(str) || str.includes('بنغلاد')) nat = isFemale ? 'بنغلاديشية' : 'بنغلاديشي';
    else if (/sudan/i.test(str) || str.includes('سودان')) nat = isFemale ? 'سودانية' : 'سوداني';
    else if (str.includes('/')) {
      const parts = str.split('/');
      const arPart = parts.find(p => /[\u0600-\u06FF]/.test(p));
      if (arPart) {
        nat = arPart.trim();
        if (isFemale && !nat.endsWith('ة') && nat.endsWith('ي')) {
          nat = nat + 'ة';
        }
      }
    } else {
      const cleaned = str.replace(/[a-zA-Z]/g, '').replace(/\//g, '').trim();
      nat = cleaned || (isFemale ? 'مصرية' : 'مصري');
      if (isFemale && !nat.endsWith('ة') && nat.endsWith('ي')) {
        nat = nat + 'ة';
      }
    }
    return nat;
  } else {
    if (/egypt/i.test(str) || str.includes('مصر')) return 'Egyptian';
    if (/bahrain/i.test(str) || str.includes('بحرين')) return 'Bahraini';
    if (/saudi/i.test(str) || str.includes('سعود')) return 'Saudi';
    if (/jordan/i.test(str) || str.includes('أردن') || str.includes('اردن')) return 'Jordanian';
    if (/indian?/i.test(str) || str.includes('هند')) return 'Indian';
    if (/pakistan/i.test(str) || str.includes('باكستان')) return 'Pakistani';
    if (/filipino|philippine/i.test(str) || str.includes('فلبين')) return 'Filipino';
    if (/syria/i.test(str) || str.includes('سور')) return 'Syrian';
    if (/leban/i.test(str) || str.includes('لبنان')) return 'Lebanese';
    if (/yemen/i.test(str) || str.includes('يمن')) return 'Yemeni';
    if (/bangla/i.test(str) || str.includes('بنغلاد')) return 'Bangladeshi';
    if (/sudan/i.test(str) || str.includes('سودان')) return 'Sudanese';
    if (str.includes('/')) {
      const parts = str.split('/');
      const enPart = parts.find(p => /[a-zA-Z]/.test(p));
      if (enPart) return enPart.trim();
    }
    const cleaned = str.replace(/[\u0600-\u06FF]/g, '').replace(/\//g, '').trim();
    return cleaned || 'Egyptian';
  }
};

export const resolveJobTitle = (raw?: string, lang: 'ar' | 'en' = 'ar', prefixCode?: string, gender: 'male' | 'female' = 'male'): string => {
  const str = (raw || '').trim();
  const prefix = (prefixCode || '').trim().toUpperCase().charAt(0);
  const isFemale = gender === 'female';

  if (lang === 'ar') {
    if (/assistant/i.test(str) || str.includes('مساعد')) return isFemale ? 'مساعدة صيدلي' : 'مساعد صيدلي';
    if (/pharm/i.test(str) || str.includes('صيدل') || prefix === 'E') return isFemale ? 'صيدلانية' : 'صيدلي';
    if (/driver/i.test(str) || str.includes('سائق') || prefix === 'D') return isFemale ? 'سائقة خدمات وتوصيل أدوية' : 'سائق خدمات وتوصيل أدوية';
    if (/manage|admin|account|director/i.test(str) || str.includes('إدار') || str.includes('ادار') || str.includes('محاسب') || str.includes('مدير') || prefix === 'M') return isFemale ? 'مسؤولة إدارية ومالية' : 'مسؤول إداري ومالي';
    if (/worker|warehouse|stock/i.test(str) || str.includes('عامل') || str.includes('مخزن') || str.includes('مخازن') || prefix === 'W') return isFemale ? 'عاملة تشغيل وخدمات ومخازن' : 'عامل تشغيل وخدمات ومخازن';
    if (str.includes('/')) {
      const parts = str.split('/');
      const arPart = parts.find(p => /[\u0600-\u06FF]/.test(p));
      if (arPart) {
        const title = arPart.replace(/قانوني/g, '').trim();
        if (isFemale) {
          if (title === 'صيدلي') return 'صيدلانية';
          if (title === 'مساعد صيدلي') return 'مساعدة صيدلي';
          if (title === 'سائق خدمات وتوصيل أدوية') return 'سائقة خدمات وتوصيل أدوية';
          if (title === 'مسؤول إداري ومالي') return 'مسؤولة إدارية ومالية';
          if (title === 'عامل تشغيل وخدمات ومخازن') return 'عاملة تشغيل وخدمات ومخازن';
          if (title === 'موظف') return 'موظفة';
        }
        return title || (isFemale ? 'صيدلانية' : 'صيدلي');
      }
    }
    const cleaned = str.replace(/[a-zA-Z]/g, '').replace(/قانوني/g, '').replace(/\//g, '').trim();
    if (isFemale && cleaned) {
      if (cleaned === 'صيدلي') return 'صيدلانية';
      if (cleaned === 'مساعد صيدلي') return 'مساعدة صيدلي';
      if (cleaned === 'موظف') return 'موظفة';
    }
    return cleaned || (isFemale ? 'صيدلانية' : 'صيدلي');
  } else {
    if (/assistant/i.test(str) || str.includes('مساعد')) return 'Assistant Pharmacist';
    if (/pharm/i.test(str) || str.includes('صيدل') || prefix === 'E') return 'Licensed Pharmacist';
    if (/driver/i.test(str) || str.includes('سائق') || prefix === 'D') return 'Logistics & Pharmacy Delivery Driver';
    if (/manage|admin|account|director/i.test(str) || str.includes('إدار') || str.includes('ادار') || str.includes('محاسب') || str.includes('مدير') || prefix === 'M') return 'Administrative & Management Staff';
    if (/worker|warehouse|stock/i.test(str) || str.includes('عامل') || str.includes('مخزن') || str.includes('مخازن') || prefix === 'W') return 'Warehouse & Operations Staff';
    if (str.includes('/')) {
      const parts = str.split('/');
      const enPart = parts.find(p => /[a-zA-Z]/.test(p));
      if (enPart) return enPart.trim();
    }
    const cleaned = str.replace(/[\u0600-\u06FF]/g, '').replace(/\//g, '').trim();
    return cleaned || 'Licensed Pharmacist';
  }
};

export const cleanBilingualString = (text?: string, lang: 'ar' | 'en' = 'ar'): string => {
  if (!text) return '';
  if (!text.includes('/')) {
    if (lang === 'ar') return text.replace(/[a-zA-Z]/g, '').trim() || text;
    return text.replace(/[\u0600-\u06FF]/g, '').trim() || text;
  }
  const parts = text.split('/');
  if (lang === 'ar') {
    const arPart = parts.find(p => /[\u0600-\u06FF]/.test(p));
    return arPart ? arPart.trim() : text.trim();
  } else {
    const enPart = parts.find(p => /[a-zA-Z]/.test(p));
    return enPart ? enPart.trim() : text.trim();
  }
};

export const generateHrLetterDocxBlob = async (data: HrLetterData): Promise<Blob> => {
  const isAr = data.lang === 'ar';
  const gender = data.gender || 'male';
  const isFemale = gender === 'female';
  const crName = isAr ? data.cr.cr_name_ar : data.cr.cr_name;
  const isSalaryMatrixRequired = ['embassy_salary', 'bank_salary_iban', 'bank_salary_undertaking'].includes(data.letterType);

  const resolvedNationality = resolveNationality(data.nationality, data.lang, gender);
  const resolvedJobTitle = resolveJobTitle(data.jobTitle, data.lang, undefined, gender);
  const resolvedDestination = cleanBilingualString(data.destinationName, data.lang);
  const resolvedNewCompany = cleanBilingualString(data.newCompanyName, data.lang);
  const resolvedBank = cleanBilingualString(data.bankName, data.lang);

  const docChildren: any[] = [];

  // Header paragraph (Bilingual matching Registered Commercial Registrations)
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: (data.cr.cr_name || 'TABARAK PHARMACY GROUP WLL').toUpperCase(), bold: true, size: 28 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: data.cr.cr_name_ar || 'مجموعة صيدليات تبارك ذ.م.م', bold: true, size: 24, color: '1e293b' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `CR NO: ${data.cr.cr_number || '100234-1'}  |  Contact: ${data.cr.phone || '+973 33866650'}  |  Email: tabarakph.info@gmail.com  |  Kingdom of Bahrain`,
          size: 19,
          color: '475569'
        }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [
        new TextRun({ text: isAr ? `التاريخ: ${data.issueDate}` : `Date: ${data.issueDate}`, bold: true, size: 22 }),
        new TextRun({ text: `\t\t\t\t\t\t\t` }),
        new TextRun({ text: isAr ? `المرجع: ${data.refNo}` : `Ref: ${data.refNo}`, bold: true, size: 22 }),
      ],
    }),
    new Paragraph({ text: '' })
  );

  // Title
  let titleText = '';
  switch (data.letterType) {
    case 'noc_transfer':
      titleText = isAr ? 'شهادة عدم ممانعة لنقل الكفالة والتحاق بالعمل' : 'NO OBJECTION CERTIFICATE FOR TRANSFER (NOC)';
      break;
    case 'experience_certificate':
      titleText = isAr ? 'شهادة خبرة وظيفية رسمية' : 'OFFICIAL EXPERIENCE CERTIFICATE';
      break;
    case 'active_employment':
      titleText = isAr ? 'شهادة إثبات عمل' : 'CERTIFICATE OF ACTIVE EMPLOYMENT';
      break;
    case 'embassy_salary':
      titleText = isAr ? 'شهادة عمل وبيان راتب موجهة للسفارة' : 'EMPLOYMENT & SALARY CERTIFICATE (VISA PURPOSE)';
      break;
    case 'bank_salary_iban':
      titleText = isAr ? 'شهادة تفاصيل الراتب واعتماد الآيبان البنكي' : 'SALARY DETAILS & IBAN CONFIRMATION LETTER';
      break;
    case 'bank_salary_undertaking':
      titleText = isAr ? 'خطاب تعهد وتثبيت تحويل راتب لقرض بنكي' : 'IRREVOCABLE SALARY TRANSFER UNDERTAKING';
      break;
  }

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_2,
      children: [
        new TextRun({ text: titleText, bold: true, size: 26, underline: { type: 'single' } }),
      ],
    }),
    new Paragraph({ text: '' })
  );

  // Addressee
  let addressee = '';
  if (data.customAddressee && data.customAddressee.trim()) {
    addressee = data.customAddressee.trim();
  } else if (data.letterType === 'embassy_salary') {
    addressee = isAr
      ? `إلى: ${resolvedDestination || 'السفارة الموقرة / قسم التأشيرات'}`
      : `To: ${resolvedDestination || 'The Respective Embassy / Visa Section'}`;
  } else if (data.letterType === 'bank_salary_iban') {
    addressee = isAr
      ? `إلى: إدارة العمليات المصرفية - ${resolvedBank || 'المصرف الموقر'}`
      : `To: Banking Operations Department - ${resolvedBank || 'The Respective Bank'}`;
  } else if (data.letterType === 'bank_salary_undertaking') {
    addressee = isAr
      ? `إلى: إدارة الائتمان والتمويل - ${resolvedBank || 'المصرف الموقر'}`
      : `To: Credit & Loans Department - ${resolvedBank || 'The Respective Bank'}`;
  } else {
    addressee = isAr ? 'إلى من يهمه الأمر،' : 'To Whom It May Concern,';
  }

  docChildren.push(
    new Paragraph({
      alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [
        new TextRun({ text: addressee, bold: true, size: 24 }),
      ],
    }),
    new Paragraph({ text: '' })
  );

  // Preamble logic
  const holderWordAr = isFemale ? 'حاملة' : 'حامل';
  const workWordAr = isFemale ? 'تعمل لدينا' : 'يعمل لدينا';

  const arPreamble = `تشهد شركة ${data.cr.cr_name_ar} (سجل تجاري رقم: ${data.cr.cr_number}) بأن ${data.employeeName}، ${resolvedNationality} الجنسية، ${holderWordAr} بطاقة هوية رقم (${data.cpr}) وجواز سفر رقم (${data.passport})، ${workWordAr} بوظيفة (${resolvedJobTitle})${data.nhraLicense ? `، وترخيص مزاولة المهنة من الهيئة الوطنية لتنظيم المهن والخدمات الصحية (NHRA) رقم: (${data.nhraLicense})` : ''} اعتباراً من تاريخ ${data.joinDate}`;

  const enPreamble = `This is to certify that ${data.employeeName},  ${resolvedNationality} national holding CPR No. ${data.cpr} and Passport No. ${data.passport}, is employed with ${data.cr.cr_name} (CR No: ${data.cr.cr_number}) as ${resolvedJobTitle}${data.nhraLicense ? `, licensed by NHRA under License No: (${data.nhraLicense})` : ''} since ${data.joinDate}`;

  // Body content
  let bodyText = '';
  if (data.letterType === 'noc_transfer') {
    const nocAr = isFemale
      ? `${arPreamble}... وتفيد الشركة بأنه لا مانع لدينا من نقل كفالتها/إقامتها والتحاقها بالعمل لدى شركة ${resolvedNewCompany || '[اسم الشركة الجديدة]'}، دون أي التزام أو مسؤولية قانونية أو مالية تترتب على شركتنا تجاه الغير، وتم إصدار هذه الشهادة بناءً على طلبها.`
      : `${arPreamble}... وتفيد الشركة بأنه لا مانع لدينا من نقل كفالته/إقامته والتحاقه بالعمل لدى شركة ${resolvedNewCompany || '[اسم الشركة الجديدة]'}، دون أي التزام أو مسؤولية قانونية أو مالية تترتب على شركتنا تجاه الغير، وتم إصدار هذه الشهادة بناءً على طلبه.`;
    const nocEn = isFemale
      ? `${enPreamble}... ${data.cr.cr_name} confirms that we have no objection to the transfer of her sponsorship and employment to ${resolvedNewCompany || '[New Company Name]'}, without any legal or financial liability on our part towards third parties. This certificate is issued upon her request.`
      : `${enPreamble}... ${data.cr.cr_name} confirms that we have no objection to the transfer of his sponsorship and employment to ${resolvedNewCompany || '[New Company Name]'}, without any legal or financial liability on our part towards third parties. This certificate is issued upon his request.`;
    bodyText = isAr ? nocAr : nocEn;
  } else if (data.letterType === 'experience_certificate') {
    const expAr = isFemale
      ? `تشهد إدارة شركة ${data.cr.cr_name_ar} (سجل تجاري رقم: ${data.cr.cr_number}) بأن ${data.employeeName}، ${resolvedNationality} الجنسية، حاملة بطاقة هوية رقم (${data.cpr}) وجواز سفر رقم (${data.passport})${data.nhraLicense ? `، ترخيص نهرا رقم (${data.nhraLicense})` : ''}، قد اكتسبت خبرة وظيفية لدينا بالعمل بمسمى (${resolvedJobTitle}) وذلك خلال الفترة من ${data.joinDate} حتى ${data.endDate || '[تاريخ انتهاء الخدمة]'}. وخلال فترة عملها أظهرت كفاءة مهنية عالية والتزاماً تاماً بالمسؤوليات والمهام الموكلة إليها، وكانَت حسنة السيرة والسلوك. قُدمت لها هذه الشهادة بناءً على طلبها مع تمنياتنا لها بمزيد من التوفيق والنجاح المهني.`
      : `تشهد إدارة شركة ${data.cr.cr_name_ar} (سجل تجاري رقم: ${data.cr.cr_number}) بأن ${data.employeeName}، ${resolvedNationality} الجنسية، حامل بطاقة هوية رقم (${data.cpr}) وجواز سفر رقم (${data.passport})${data.nhraLicense ? `، ترخيص نهرا رقم (${data.nhraLicense})` : ''}، قد اكتسب خبرة وظيفية لدينا بالعمل بمسمى (${resolvedJobTitle}) وذلك خلال الفترة من ${data.joinDate} حتى ${data.endDate || '[تاريخ انتهاء الخدمة]'}. وخلال فترة عمله أظهر كفاءة مهنية عالية والتزاماً تاماً بالمسؤوليات والمهام الموكلة إليه، وكان حسن السيرة والسلوك. قُدمت له هذه الشهادة بناءً على طلبه مع تمنياتنا له بمزيد من التوفيق والنجاح المهني.`;
    const expEn = isFemale
      ? `This is to certify that ${data.employeeName},  ${resolvedNationality} national holding CPR No. ${data.cpr} and Passport No. ${data.passport}${data.nhraLicense ? `, NHRA License No: ${data.nhraLicense}` : ''}, has acquired professional work experience with ${data.cr.cr_name} (CR No: ${data.cr.cr_number}) serving as ${resolvedJobTitle} from ${data.joinDate} to ${data.endDate || '[End Date]'}. Throughout her tenure, she demonstrated high professional competence, integrity, and dedication to all assigned responsibilities. This certificate is issued upon her request, wishing her continued career success.`
      : `This is to certify that ${data.employeeName},  ${resolvedNationality} national holding CPR No. ${data.cpr} and Passport No. ${data.passport}${data.nhraLicense ? `, NHRA License No: ${data.nhraLicense}` : ''}, has acquired professional work experience with ${data.cr.cr_name} (CR No: ${data.cr.cr_number}) serving as ${resolvedJobTitle} from ${data.joinDate} to ${data.endDate || '[End Date]'}. Throughout his tenure, he demonstrated high professional competence, integrity, and dedication to all assigned responsibilities. This certificate is issued upon his request, wishing him continued career success.`;
    bodyText = isAr ? expAr : expEn;
  } else if (data.letterType === 'active_employment') {
    const actAr = isFemale
      ? `${arPreamble} بموجب عقد عمل ساري المفعول وحتى تاريخه، وما زالت على رأس عملها. أعطيت لها هذه الشهادة بناءً على طلبها لتقديمها للجهات المعنية دون أدنى مسؤولية على الشركة.`
      : `${arPreamble} بموجب عقد عمل ساري المفعول وحتى تاريخه، وما زال على رأس عمله. أعطيت له هذه الشهادة بناءً على طلبه لتقديمها للجهات المعنية دون أدنى مسؤولية على الشركة.`;
    const actEn = isFemale
      ? `${enPreamble} under an active, valid employment contract and continues to be in active service to date. This letter is issued upon her request for official purposes without liability on the company.`
      : `${enPreamble} under an active, valid employment contract and continues to be in active service to date. This letter is issued upon his request for official purposes without liability on the company.`;
    bodyText = isAr ? actAr : actEn;
  } else if (data.letterType === 'embassy_salary') {
    const embAr = isFemale
      ? `${arPreamble} بدوام كامل ومستمرة بالعمل.\nنوضح أدناه جدول مفردات الراتب الشهري المعتمد للموظفة:`
      : `${arPreamble} بدوام كامل ومستمر بالعمل.\nنوضح أدناه جدول مفردات الراتب الشهري المعتمد للموظف:`;
    const embEn = `${enPreamble} on a full-time, active employment status.\nPlease find below the approved monthly salary matrix breakdown for the employee:`;
    bodyText = isAr ? embAr : embEn;
  } else if (data.letterType === 'bank_salary_iban') {
    const ibanAr = isFemale
      ? `${arPreamble}.\nنحيطكم علماً بمفردات الراتب الشهري للمذكورة كما هو موضح بالجدول أدناه:`
      : `${arPreamble}.\nنحيطكم علماً بمفردات الراتب الشهري للمذكور كما هو موضح بالجدول أدناه:`;
    const ibanEn = `${enPreamble}.\nPlease find below the detailed monthly salary matrix breakdown for the employee:`;
    bodyText = isAr ? ibanAr : ibanEn;
  } else if (data.letterType === 'bank_salary_undertaking') {
    const bankAr = isFemale
      ? `بناءً على طلب الموظفة، ${arPreamble}.\nنوضح أدناه مفردات راتبها الشهري:`
      : `بناءً على طلب الموظف، ${arPreamble}.\nنوضح أدناه مفردات راتبه الشهري:`;
    const bankEn = isFemale
      ? `Upon the request of the employee, ${enPreamble}.\nPlease find below the monthly salary matrix breakdown:`
      : `Upon the request of the employee, ${enPreamble}.\nPlease find below the monthly salary matrix breakdown:`;
    bodyText = isAr ? bankAr : bankEn;
  }

  docChildren.push(
    new Paragraph({
      alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { line: 360 },
      children: [
        new TextRun({ text: bodyText, size: 24 }),
      ],
    }),
    new Paragraph({ text: '' })
  );

  // Salary Table if required
  if (isSalaryMatrixRequired) {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: isAr ? 'البيان الوظيفي للراتب' : 'Salary Component', run: { bold: true } })]
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: isAr ? 'المبلغ الشهري (د.ب)' : 'Monthly Amount (BHD)', run: { bold: true }, alignment: AlignmentType.RIGHT })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: isAr ? 'الراتب الأساسي' : 'Basic Salary' })] }),
          new TableCell({ children: [new Paragraph({ text: `${data.basicSalary.toFixed(3)} BHD`, alignment: AlignmentType.RIGHT })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: isAr ? 'بدل السكن' : 'Housing Allowance' })] }),
          new TableCell({ children: [new Paragraph({ text: `${data.housingAllowance.toFixed(3)} BHD`, alignment: AlignmentType.RIGHT })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: isAr ? 'بدل المواصلات' : 'Transportation Allowance' })] }),
          new TableCell({ children: [new Paragraph({ text: `${data.transportationAllowance.toFixed(3)} BHD`, alignment: AlignmentType.RIGHT })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: isAr ? 'علاوة الحوافز والمسؤولية' : 'Incentive / Responsibility Bonus' })] }),
          new TableCell({ children: [new Paragraph({ text: `${data.incentiveBonus.toFixed(3)} BHD`, alignment: AlignmentType.RIGHT })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: isAr ? 'إجمالي الراتب الشهري الصافي' : 'TOTAL MONTHLY SALARY', run: { bold: true } })] }),
          new TableCell({ children: [new Paragraph({ text: `${data.totalSalary.toFixed(3)} BHD`, run: { bold: true }, alignment: AlignmentType.RIGHT })] })
        ]
      })
    ];

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
      }),
      new Paragraph({ text: '' })
    );

    // Follow-up paragraphs after table
    let postTableText = '';
    if (data.letterType === 'embassy_salary') {
      postTableText = isAr
        ? (isFemale ? 'كما نؤكد أن الشركة وافقت على منحها إجازة رسمية للسفر، وستعود لمباشرة عملها فور انتهاء الإجازة.' : 'كما نؤكد أن الشركة وافقت على منحه إجازة رسمية للسفر، وسيعود لمباشرة عمله فور انتهاء الإجازة.')
        : (isFemale ? 'We confirm that approved leave has been granted for her travel, and she will resume her official employment upon return.' : 'We confirm that approved leave has been granted for his travel, and he will resume his official employment upon return.');
    } else if (data.letterType === 'bank_salary_iban') {
      postTableText = isAr
        ? (isFemale ? `ويتم تحويل صافي راتبها الشهري بانتظام إلى حسابها المصرفي لديكم رقم الآيبان: ${data.iban || '[رقم الآيبان]'}.` : `ويتم تحويل صافي راتبه الشهري بانتظام إلى حسابه المصرفي لديكم رقم الآيبان: ${data.iban || '[رقم الآيبان]'}.`)
        : (isFemale ? `Her net monthly salary is regularly transferred directly to her account with your bank under IBAN: ${data.iban || '[IBAN Number]'}.` : `His net monthly salary is regularly transferred directly to his account with your bank under IBAN: ${data.iban || '[IBAN Number]'}.`);
    } else if (data.letterType === 'bank_salary_undertaking') {
      postTableText = isAr
        ? (isFemale ? `ونتعهد نحن شركة ${data.cr.cr_name_ar} بتحويل راتبها الشهري إلى حسابها لديكم رقم الآيبان (${data.iban || '[رقم الآيبان]'}). كما نتعهد بعدم إيقاف أو تحويل الراتب لبنك آخر، أو صرف مستحقات مكافأة نهاية الخدمة إلا بعد استلام خطاب براءة ذمة رسمي ونهائي من مصرفكم الموقر.` : `ونتعهد نحن شركة ${data.cr.cr_name_ar} بتحويل راتبه الشهري إلى حسابه لديكم رقم الآيبان (${data.iban || '[رقم الآيبان]'}). كما نتعهد بعدم إيقاف أو تحويل الراتب لبنك آخر، أو صرف مستحقات مكافأة نهاية الخدمة إلا بعد استلام خطاب براءة ذمة رسمي ونهائي من مصرفكم الموقر.`)
        : (isFemale ? `${data.cr.cr_name} irrevocably undertakes to transfer her monthly salary directly to her account with your bank (IBAN: ${data.iban || '[IBAN Number]'}). We further undertake not to divert or cease her salary transfer, nor release end-of-service gratuity, without receiving an official written clearance letter from your bank.` : `${data.cr.cr_name} irrevocably undertakes to transfer his monthly salary directly to his account with your bank (IBAN: ${data.iban || '[IBAN Number]'}). We further undertake not to divert or cease his salary transfer, nor release end-of-service gratuity, without receiving an official written clearance letter from your bank.`);
    }

    if (postTableText) {
      docChildren.push(
        new Paragraph({
          alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { line: 360 },
          children: [
            new TextRun({ text: postTableText, size: 24 }),
          ],
        }),
        new Paragraph({ text: '' })
      );
    }
  }

  // Custom notes if any
  if (data.customNotes && data.customNotes.trim()) {
    docChildren.push(
      new Paragraph({
        alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({ text: data.customNotes.trim(), size: 22, italics: true }),
        ],
      }),
      new Paragraph({ text: '' })
    );
  }

  // Footer / Signatures
  docChildren.push(
    new Paragraph({ text: '' }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ text: '______________________', alignment: AlignmentType.CENTER }),
                new Paragraph({ text: data.signatoryName || 'Dr. Fathy Saad Amin', alignment: AlignmentType.CENTER, run: { bold: true } }),
                new Paragraph({ text: data.signatoryRole || (isAr ? 'المدير التنفيذي' : 'CEO'), alignment: AlignmentType.CENTER, run: { bold: true } }),
                new Paragraph({ text: crName, alignment: AlignmentType.CENTER }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({ text: '______________________', alignment: AlignmentType.CENTER }),
                new Paragraph({ text: isAr ? 'ختم المنشأة الرسمي' : "Official Company's Seal", alignment: AlignmentType.CENTER, run: { bold: true } }),
                new Paragraph({ text: data.withoutSealAndSignature ? (isAr ? '[مساحة للختم اليدوي]' : '[Space for Manual Stamp]') : (isAr ? '[معتمد إلكترونياً]' : '[Electronically Certified]'), alignment: AlignmentType.CENTER }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: isAr ? 'Arial' : 'Arial',
            size: 24, // 12pt
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
};
