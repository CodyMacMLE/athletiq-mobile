"use client";

import { Providers } from "@/components/providers/Providers";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
