import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Early Years Claims",
  description: "Case management for childcare provider funding claims",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en-GB">
      <body>
        {user && (
          <header className="topbar">
            <Link href="/cases?status=open" className="brand">Early Years Claims</Link>
            <nav>
              <Link href="/cases?status=open">Cases</Link>
              <Link href="/cases?assignee=me&status=open">My cases</Link>
              <Link href="/providers">Settings</Link>
              {user.role === "manager" && <Link href="/admin">Admin</Link>}
            </nav>
            <div className="who">
              <Link href="/account">
                {user.display_name} ({user.role})
              </Link>
              <form action={logoutAction}>
                <button type="submit">Sign out</button>
              </form>
            </div>
          </header>
        )}
        <main>{children}</main>
      </body>
    </html>
  );
}
