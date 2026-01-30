"use server";

import { signOut } from "better-auth";

export async function logout() {
  await signOut();
}
