import { EventsPage } from "../../components/dashboard";
import { getDashboardContent } from "../../lib/dashboard-content";

export default async function Page() {
  const data = await getDashboardContent();

  return <EventsPage data={{ ...data, enableLiveUpdates: true, enableEventStream: true, enableMutations: true }} />;
}
