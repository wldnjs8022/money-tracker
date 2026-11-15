import type { Metadata } from "next";

// The page is a client component and can't export metadata, so its title lives here.
export const metadata: Metadata = { title: "로그인" };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
