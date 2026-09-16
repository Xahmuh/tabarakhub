import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const srcPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\bb53dac1-172f-475f-b14d-e206d358e8c9\\media__1788571117551.png';
    const destPath = path.join(process.cwd(), 'public', 'signature.png');

    if (fs.existsSync(srcPath)) {
      const data = fs.readFileSync(srcPath);
      fs.writeFileSync(destPath, data);
      return NextResponse.json({ success: true, message: 'Copied original signature.png successfully' });
    }
    return NextResponse.json({ success: false, message: 'Source image file not found' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
