import RunsPage from "../../../runs/page";

export default function SessionRunsPage({ params }: { params: { id: string } }) {
  return <RunsPage searchParams={{ classSessionId: params.id }} />;
}
