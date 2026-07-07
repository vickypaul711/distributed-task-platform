import { DashboardPage } from "../components/dashboard";
import { getDashboardContent } from "../lib/dashboard-content";

export default async function Page() {
  const data = await getDashboardContent();

  return <DashboardPage data={{ ...data, enableLiveUpdates: true, enableEventStream: false, enableMutations: true }} />;
}
