"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateRunalyzeToken } from "@/lib/runalyze";

export async function saveRunalyzeToken(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  const token = String(formData.get("token") ?? "").trim();
  if (!token) throw new Error("empty token");

  const check = await validateRunalyzeToken(token);
  if (!check.ok) {
    throw new Error(
      check.status === 401 || check.status === 403
        ? `Runalyze rejected the token (HTTP ${check.status}). Note: Runalyze only gives Personal-API read access to Supporter/Premium accounts — on a free account the API is upload-only, so predictions can't be read out. Also check the token was copied fully and hasn't expired.`
        : `Couldn't reach Runalyze to validate the token (status ${check.status || "network error"}). Try again.`,
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { runalyzeToken: token },
  });
  revalidatePath("/predictions");
}

export async function removeRunalyzeToken(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { runalyzeToken: null },
  });
  revalidatePath("/predictions");
}
