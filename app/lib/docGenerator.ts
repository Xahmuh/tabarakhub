import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { HRRequest } from '../../types';

export const getPharmacyLicense = (sponsor: string | undefined): string => {
    if (!sponsor) return "[ Pharmacy License ]";
    const s = sponsor.toLowerCase();
    if (s.includes('alnahar')) return "32000255";
    if (s.includes('janabiya')) return "32000691";
    if (s.includes('jamila')) return "32000690";
    if (s.includes('sanad 2')) return "32000752";
    if (s.includes('sanad')) return "32000532";
    if (s.includes('tabarak')) return "32000185";
    if (s.includes('alhoda') || s.includes('hoda')) return "32000783";
    if (s.includes('damistan')) return "32000721";
    if (s.includes('district')) return "32000706";
    return "[ Pharmacy License ]";
};

export const getPharmacyCR = (sponsor: string | undefined): string => {
    if (!sponsor) return "";
    const s = sponsor.toLowerCase();
    if (s.includes('alnahar')) return "106723-2";
    if (s.includes('janabiya')) return "145842-3";
    if (s.includes('jamila')) return "145842-2";
    if (s.includes('sanad 2')) return "145842-4";
    if (s.includes('sanad')) return "145842-1";
    if (s.includes('tabarak')) return "127506-1";
    if (s.includes('alhoda') || s.includes('hoda')) return "106723-1";
    if (s.includes('damistan')) return "172593-2";
    if (s.includes('district')) return "172593-1";
    return "";
};

export const generateDocumentBlob = async (req: HRRequest, typeOverride?: string): Promise<Blob> => {
    const currentDate = new Date().toLocaleDateString('en-GB');

    let isExperienceCert = false;
    let isEmploymentCert = false;
    let isSalaryCert = false;

    if (typeOverride) {
        if (typeOverride.toLowerCase().includes('experience')) isExperienceCert = true;
        else if (typeOverride.toLowerCase().includes('employment')) isEmploymentCert = true;
        else if (typeOverride.toLowerCase().includes('salary')) isSalaryCert = true;
    } else {
        isExperienceCert = req.docTypes.some(t => t.toLowerCase().includes('experience'));
        if (!isExperienceCert) isEmploymentCert = req.docTypes.some(t => t.toLowerCase().includes('employment'));
        if (!isExperienceCert && !isEmploymentCert) isSalaryCert = req.docTypes.some(t => t.toLowerCase().includes('salary'));
    }

    const employeeName = (req.passportName || req.employeeName).toUpperCase();
    let docChildren: any[] = [];

    if (isExperienceCert) {
        docChildren = [
            new Paragraph({
                text: `Date: ${currentDate}`,
                alignment: AlignmentType.LEFT,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "EXPERIENCE CERTIFICATE",
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                run: { bold: true, size: 28, underline: { type: "single" } }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "To Whom It May Concern,",
                alignment: AlignmentType.LEFT,
                run: { bold: true }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "This is to certify that " }),
                    new TextRun({ text: employeeName, bold: true }),
                    new TextRun({ text: ", with CPR no ( " }),
                    new TextRun({ text: req.cpr, bold: true }),
                    new TextRun({ text: " ) and passport no ( " }),
                    new TextRun({ text: req.passport || "[ Passport No ]", bold: true }),
                    new TextRun({ text: " ), Licensed Pharmacist (License No.: " }),
                    new TextRun({ text: req.license || "[ License No ]", bold: true }),
                    new TextRun({ text: "), has been employed at " }),
                    new TextRun({ text: req.sponsor || "[ Sponsor/Pharmacy Name ]", bold: true }),
                    new TextRun({ text: ", Licensed Pharmacy (License No " }),
                    new TextRun({ text: getPharmacyLicense(req.sponsor), bold: true }),
                    new TextRun({ text: "), with CR no ( " }),
                    new TextRun({ text: getPharmacyCR(req.sponsor), bold: true }),
                    new TextRun({ text: " ), since " }),
                    new TextRun({ text: req.joinDate || "[ Joining Date ]", bold: true }),
                    new TextRun({ text: " and is currently still employed with us." }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "This certificate is issued upon the employee request for submission to the National Health Regulatory Authority (NHRA).",
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
        ];
    } else if (isEmploymentCert) {
        docChildren = [
            new Paragraph({
                text: `Date: ${currentDate}`,
                alignment: AlignmentType.LEFT,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "EMPLOYMENT CERTIFICATE",
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                run: { bold: true, size: 28, underline: { type: "single" } }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "To Whom It May Concern,",
                alignment: AlignmentType.LEFT,
                run: { bold: true }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "This is to certify that " }),
                    new TextRun({ text: employeeName, bold: true }),
                    new TextRun({ text: ", with CPR no ( " }),
                    new TextRun({ text: req.cpr, bold: true }),
                    new TextRun({ text: " ) and passport no ( " }),
                    new TextRun({ text: req.passport || "[ Passport No ]", bold: true }),
                    new TextRun({ text: " ), Licensed Pharmacist (License No.: " }),
                    new TextRun({ text: req.license || "[ License No ]", bold: true }),
                    new TextRun({ text: "), has been employed at " }),
                    new TextRun({ text: req.sponsor || "[ Sponsor/Pharmacy Name ]", bold: true }),
                    new TextRun({ text: ", with CR no ( " }),
                    new TextRun({ text: getPharmacyCR(req.sponsor), bold: true }),
                    new TextRun({ text: " ), since " }),
                    new TextRun({ text: req.joinDate || "[ Joining Date ]", bold: true }),
                    new TextRun({ text: " and is currently still employed with us." }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "This certificate is issued upon the employee’s request and for whatever purpose it may serve.",
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "Sincerely,",
                alignment: AlignmentType.LEFT,
            }),
        ];
    } else if (isSalaryCert) {
        docChildren = [
            new Paragraph({
                text: `Date: ${currentDate}`,
                alignment: AlignmentType.LEFT,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "SALARY CERTIFICATE",
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                run: { bold: true, size: 28, underline: { type: "single" } }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "To Whom It May Concern,",
                alignment: AlignmentType.LEFT,
                run: { bold: true }
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "This is to certify that " }),
                    new TextRun({ text: employeeName, bold: true }),
                    new TextRun({ text: ", with CPR no ( " }),
                    new TextRun({ text: req.cpr, bold: true }),
                    new TextRun({ text: " ) and passport no ( " }),
                    new TextRun({ text: req.passport || "[ Passport No ]", bold: true }),
                    new TextRun({ text: " ), is currently employed as a Pharmacist at " }),
                    new TextRun({ text: `${req.sponsor} – CR No. ${getPharmacyCR(req.sponsor)}`, bold: true }),
                    new TextRun({ text: "." }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "The employee has been employed with us since " }),
                    new TextRun({ text: req.joinDate || "[ Joining Date ]", bold: true }),
                    new TextRun({ text: " and is receiving a monthly salary of " }),
                    new TextRun({ text: `${req.salary || "___"} BHD`, bold: true }),
                    new TextRun({ text: ", inclusive of allowances (as applicable)." }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "The certificate is issued upon the employee’s request and without any liability on the employer.",
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "Sincerely,",
                alignment: AlignmentType.LEFT,
            }),
        ];
    } else {
        // --- GENERIC TEMPLATE (Fallback) ---
        docChildren = [
            new Paragraph({
                text: "Tabarak Group HR Department",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Date: ", bold: true }),
                    new TextRun({ text: currentDate }),
                ],
                alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Ref: ", bold: true }),
                    new TextRun({ text: req.refNum }),
                ],
                alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                text: "TO WHOM IT MAY CONCERN",
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                thematicBreak: true
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "This is to certify that " }),
                    new TextRun({ text: `Mr./Ms. ${employeeName}`, bold: true }),
                    new TextRun({ text: `, holding CPR Number ` }),
                    new TextRun({ text: req.cpr, bold: true }),
                    new TextRun({ text: `, is an employee of Tabarak Group.` }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "This letter is issued upon the request of the employee for the purpose of: " }),
                    new TextRun({ text: req.docReason || "General administrative purposes.", italics: true }),
                ],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: 360 },
            }),
            new Paragraph({ text: "" }),
            new Paragraph({
                children: [
                    new TextRun({ text: "Requested Document Type: ", bold: true }),
                    new TextRun({ text: req.docTypes.join(", ") }),
                ],
                alignment: AlignmentType.LEFT,
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "" }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({ text: "______________________", alignment: AlignmentType.CENTER }),
                                    new Paragraph({ text: "HR Manager", alignment: AlignmentType.CENTER, run: { bold: true } }),
                                ],
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({ text: "______________________", alignment: AlignmentType.CENTER }),
                                    new Paragraph({ text: "Official Stamp", alignment: AlignmentType.CENTER, run: { bold: true } }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ];
    }

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {
                        font: "Arial",
                        size: 26, // 13pt
                    },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 2880, // 2 inches
                        right: 1440,
                        bottom: 1440,
                        left: 1440,
                    },
                },
            },
            children: docChildren,
        }],
    });

    return await Packer.toBlob(doc);
};
