import { WorkersPage } from "../../components/dashboard";
import { getDashboardContent } from "../../lib/dashboard-content";

export default async function Page() {
  const data = await getDashboardContent();

  return <WorkersPage data={{ ...data, enableLiveUpdates: true, enableEventStream: false, enableMutations: true }} />;
}
