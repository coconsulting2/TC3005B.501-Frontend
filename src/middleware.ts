import type { MiddlewareHandler } from 'astro';
import { roleRoutes, allWhitelistedRoutes } from '@config/routeAccess';
import { unauthorizedPage } from '@utils/unauthorizedPage';

function matchPath(path: string, patterns: string[]) {
  return patterns.some(pattern => {
    if (pattern.endsWith('/*')) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern;
  });
}
export const publicRoutes = [ '/login', '/404' ];

function readCookieFromHeader(cookieHeader: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : '';
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cookieHeader = request.headers.get('cookie') || '';
  const role = readCookieFromHeader(cookieHeader, 'role');
  const token = readCookieFromHeader(cookieHeader, 'token');
  const isAuthenticated = Boolean(role || token);

  if (url.pathname === "/") {
    return Response.redirect(new URL("/login", request.url), 302);
  }

  // 1. Rutas públicas
  if (matchPath(pathname, publicRoutes)) {
    // Ya autenticado → no mostrar login otra vez
    if (pathname === '/login' && isAuthenticated) {
      return Response.redirect(new URL('/dashboard', request.url), 302);
    }
    return next();
  }
  
  // 2. Sesión requerida (rol en cookies del frontend; ver LoginForm / login.astro)
  const html = unauthorizedPage(pathname, isAuthenticated);

  // 2.1 Sin rol → login
  if (!role) {
    return Response.redirect(new URL('/login', request.url), 302);
  }

  // 3. Validar si la ruta está registrada en el sistema
  const isKnownRoute = matchPath(pathname, allWhitelistedRoutes);
  if (!isKnownRoute) {
    //return Response.redirect(new URL('/404', request.url), 302);
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  // 4. Validar si el rol tiene acceso a la ruta
  const allowedRoutes = roleRoutes[role as keyof typeof roleRoutes] ?? [];
  const isAuthorized = matchPath(pathname, allowedRoutes);

  if (!isAuthorized) {
    //return Response.redirect(new URL('/404', request.url), 302);
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  return next();
};