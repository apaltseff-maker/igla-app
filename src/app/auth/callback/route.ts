import { NextResponse } from 'next/server';

// This route handles OAuth callbacks with code parameter
// Hash-based tokens (#access_token=...) are handled client-side
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/app';

  // Handle code-based OAuth (if used)
  if (code) {
    // This will be handled by the client-side callback page
    return NextResponse.redirect(
      new URL(`/auth/callback?code=${code}&next=${next}`, requestUrl.origin)
    );
  }

  // No valid code - redirect to login
  return NextResponse.redirect(
    new URL('/login?error=invalid_callback', requestUrl.origin)
  );
}
