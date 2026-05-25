import ClassSessionDashboard from "../page";

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  return <ClassSessionDashboard params={params} />;
}
