import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function GET() {
  cookies().delete("rm_participant_id");
  cookies().delete("rm_participant_token");
  redirect("/join");
}
