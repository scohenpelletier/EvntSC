import { AuthPage } from "../auth-page";

export default async function Page({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const notice = sp.signedOut ? "You have been signed out." : sp.error ? "That link is invalid or has expired. Try again." : null;
  return <AuthPage mode="sign-in" notice={notice} />;
}
