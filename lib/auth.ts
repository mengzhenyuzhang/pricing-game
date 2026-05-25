import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "rm_admin_session";

function secret() {
  const value = process.env.SESSION_SECRET || "dev-secret-change-me";
  return new TextEncoder().encode(value);
}

export async function createAdminSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());

  cookies().set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export function clearAdminSession() {
  cookies().delete(cookieName);
}

export async function isAdmin() {
  const token = cookies().get(cookieName)?.value;
  if (!token) return false;
  try {
    const verified = await jwtVerify(token, secret());
    return verified.payload.role === "admin";
  } catch {
    return false;
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
