import { SchedulesPage } from "../../components/dashboard";
import { getDashboardContent } from "../../lib/dashboard-content";

export default async function Page() {
  const data = await getDashboardContent();

  return <SchedulesPage data={{ ...data, enableLiveUpdates: true, enableEventStream: false, enableMutations: true }} />;
}
