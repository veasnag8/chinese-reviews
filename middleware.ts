import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

<<<<<<< Updated upstream
  const protectedPaths = ['/dashboard', '/words', '/sentences', '/daily', '/classes', '/favorites', '/progress', '/settings', '/writing', '/review', '/quizzes'];
=======
  let userExists = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    userExists = !!profile;
  }

  const protectedPaths = ['/dashboard', '/words', '/sentences', '/daily', '/classes', '/favorites', '/progress', '/settings', '/writing', '/review', '/quizzes', '/admin'];
>>>>>>> Stashed changes
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));
  
  // Allow login and register pages without auth
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');

<<<<<<< Updated upstream
  if (isProtectedPath && !user && !isAuthPage) {
=======
  if (isProtectedPath && (!user || !userExists) && !isAuthPage) {
    // If env vars not configured, don't redirect to login (it won't work either)
    if (!supabaseUrl || !supabaseKey) {
      return supabaseResponse;
    }
    
    // Clear auth cookies if user doesn't exist in database
    if (user && !userExists) {
      await supabase.auth.signOut();
    }
    
>>>>>>> Stashed changes
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};