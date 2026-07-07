import { JobsPage } from "../../components/dashboard";
import { getDashboardContent } from "../../lib/dashboard-content";

export default async function Page() {
  const data = await getDashboardContent();

  return <JobsPage data={{ ...data, enableLiveUpdates: true, enableEventStream: false, enableMutations: true }} />;
}
