export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

const SettingsPage = () => {
  redirect("/settings/general");
};

export default SettingsPage;
