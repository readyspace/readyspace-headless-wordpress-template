import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { siteConfig } from '@/lib/config';
export async function GET() {
  (await draftMode()).disable();
  const response=NextResponse.redirect(siteConfig().deploymentUrl);
  response.cookies.delete('readyspace_preview');
  response.headers.set('Cache-Control','no-store'); return response;
}
