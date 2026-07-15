import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const jar = await cookies();
  const token = jar.get("unichat_admin_token")?.value;
  if (token) redirect("/dashboard");
  else redirect("/login");
}
